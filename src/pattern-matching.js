import libConnection from '@buggyorg/component-library'
import _ from 'lodash'
var compLib = libConnection('http://quasar:9200')

function getInputs (nodesObj, meta) {
  return Object.keys(nodesObj[meta]['inputPorts'])
}

function getOutputs (nodesObj, meta) {
  return Object.keys(nodesObj[meta]['outputPorts'])
}

var nodesIds = [
  {id: 'logic/equal', version: '0.1.0'},
  {id: 'logic/and', version: '0.1.0'},
  {id: 'logic/or', version: '0.1.0'},
  {id: 'logic/not', version: '0.1.0'},
  {id: 'logic/demux', version: '0.1.0'}
]

export function convert (expression) {
  var nodesPromise = nodesIds.map(node => {
    return compLib.get(node.id, node.version)
  })

  return Promise.all(nodesPromise).then((nodesArr) => {
    var nodesObj = _.keyBy(nodesArr, 'id')

    var graph = expression
    var nodeId = 0
    var allRules = []
    for (var exp = 0; exp < expression.nodes().length; exp++) {
      var rules = expression.node(expression.nodes()[exp])['rules']
      for (var expRule = 0; expRule < rules.length; expRule++) {
        allRules.push(rules[expRule])
      }
    }
    var res
    var ruleTriple = []
    for (var rule = 0; rule < rules.length; rule++) {
      var numberOfConstants = 0
      var inputs = rules[rule]['inputs']
      var equalNodes = []
      for (var input = 0; input < inputs.length; input++) {
        if (inputs[input]['type'] === 'constant') {
          numberOfConstants++
          res = createEqualAndConst(inputs[input]['value/const'], inputs[input]['name'], nodeId, graph, nodesObj)
          nodeId = res['newNodeId']
          equalNodes.push(res['equalNode'])
        }
      }
      if (equalNodes.length > 1) {
        res = createAtomics(equalNodes, nodeId, graph, 'AND', nodesObj)
        nodeId = res['nodeId']
        ruleTriple.push({rule: rules[rule], numberOfConstants: numberOfConstants, endBoolNode: res['node']})
      } else if (equalNodes.length === 1) {
        ruleTriple.push({rule: rules[rule], numberOfConstants: numberOfConstants, endBoolNode: equalNodes[0]})
      } else {
        ruleTriple.push({rule: rules[rule], numberOfConstants: numberOfConstants, endBoolNode: null})
      }
    }
    ruleTriple.sort(function (a, b) {
      return b.numberOfConstants - a.numberOfConstants
    })
    var maxRuleCount = ruleTriple[0]['numberOfConstants']
    var currentStep = maxRuleCount
    var orInputs = []
    var lastOr

    for (var r = 0; r < ruleTriple.length; r++) {
      if (ruleTriple[r]['numberOfConstants'] === maxRuleCount) {
        // these are the rules with the maximal amount of constants
        orInputs.push(ruleTriple[r]['endBoolNode'])
      } else {
        if (ruleTriple[r]['numberOfConstants'] !== currentStep) {
          currentStep = ruleTriple[r]['numberOfConstants']
          res = createAtomics(orInputs, nodeId, graph, 'OR', nodesObj)
          nodeId = res['nodeId']
          lastOr = res['node']
          orInputs = [lastOr]
        }
        // create the not node
        var nodeNot = nodeId + '_NOT'
        nodeId++
        graph.setNode(nodeNot, {nodeType: 'process', meta: 'logic/not', type: 'atomic'})
        graph.setParent(nodeNot, 'PARENT')

        graph.setEdge(lastOr, nodeNot, {'outPort': getOutputs(nodesObj, 'logic/or')[0], 'inPort': getInputs(nodesObj, 'logic/not')[0]})
        if (ruleTriple[r]['numberOfConstants'] > 0) {
          // create the and node
          var nodeAnd = nodeId + '_AND'
          nodeId++
          graph.setNode(nodeAnd, {nodeType: 'process', meta: 'logic/and', type: 'atomic'})
          graph.setParent(nodeAnd, 'PARENT')
          graph.setEdge(nodeNot, nodeAnd, {'outPort': getOutputs(nodesObj, 'logic/not')[0], 'inPort': getInputs(nodesObj, 'logic/and')[0]})
          graph.setEdge(ruleTriple[r]['endBoolNode'], nodeAnd, {'outPort': getOutputs(nodesObj, graph.node(ruleTriple[r]['endBoolNode'])['meta'])[0], 'inPort': getInputs(nodesObj, 'logic/and')[1]})
          ruleTriple[r]['endBoolNode'] = nodeAnd
        } else {
          ruleTriple[r]['endBoolNode'] = nodeNot
        }

        orInputs.push(ruleTriple[r]['endBoolNode'])
      }
    }

    for (var ru = 0; ru < ruleTriple.length; ru++) {
      var outports = ruleTriple[ru]['rule']['outputs']
      for (var outport = 0; outport < outports.length; outport++) {
        var nodeDemux = nodeId + '_DEMUX'
        nodeId++
        if (outports[outport]['type'] === 'constant') {
          graph.setNode(nodeDemux, {nodeType: 'process', meta: 'logic/demux', type: 'atomic', values: [{'value': outports[outport]['value/const'], 'port': getInputs(nodesObj, 'logic/demux')[0]}]})
        } else {
          graph.setNode(nodeDemux, {nodeType: 'process', meta: 'logic/demux', type: 'atomic'})
          var inports = ruleTriple[ru]['rule']['inputs']
          for (var i = 0; i < inports.length; i++) {
            if (inports[i]['value'] === outports[outport]['value']) {
              graph.setEdge('PARENT', nodeDemux, {'outPort': inports[i]['name'], 'inPort': getInputs(nodesObj, 'logic/demux')[0]})
            }
          }
        }
        graph.setParent(nodeDemux, 'PARENT')
        graph.setEdge(ruleTriple[ru]['endBoolNode'], nodeDemux, {'outPort': getOutputs(nodesObj, graph.node(ruleTriple[ru]['endBoolNode'])['meta'])[0], 'inPort': getInputs(nodesObj, 'logic/demux')[1]})
        graph.setEdge(nodeDemux, 'PARENT', {'outPort': getOutputs(nodesObj, 'logic/demux')[0], 'inPort': outports[outport]['name']})
      }
    }
    return graph
  }).catch(function (err) { console.error(err) })
}

function createEqualAndConst (constValue, edgeName, nodeId, graph, nodesObj) {
  var nodeEqual = nodeId + '_EQUAL'
  nodeId++
  graph.setNode(nodeEqual, {nodeType: 'process', meta: 'logic/equal', type: 'atomic', values: [{'value': constValue, 'port': getInputs(nodesObj, 'logic/equal')[1]}]})
  graph.setParent(nodeEqual, 'PARENT')
  graph.setEdge('PARENT', nodeEqual, {'outPort': edgeName, 'inPort': getInputs(nodesObj, 'logic/equal')[0]})
  return {equalNode: nodeEqual, newNodeId: nodeId}
}

function createAtomics (inputs, nodeId, graph, nodeName, nodesObj) {
  if (inputs.length === 1) {
    return {nodeId: nodeId, node: inputs[0]}
  }
  var node = nodeId + '_' + nodeName
  nodeId++
  graph.setNode(node, {nodeType: 'process', meta: 'logic/' + nodeName.toLowerCase(), type: 'atomic'})
  graph.setParent(node, 'PARENT')
  graph.setEdge(inputs[0], node, {'outPort': getOutputs(nodesObj, graph.node(inputs[0])['meta'])[0], 'inPort': getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[0]})
  graph.setEdge(inputs[1], node, {'outPort': getOutputs(nodesObj, graph.node(inputs[1])['meta'])[0], 'inPort': getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[1]})
  for (var i = 2; i < inputs.length; i++) {
    var newNode = nodeId + '_' + nodeName
    nodeId++
    graph.setNode(newNode, {nodeType: 'process', meta: 'logic/' + nodeName.toLowerCase(), type: 'atomic'})
    graph.setParent(newNode, 'PARENT')
    graph.setEdge(inputs[i], newNode, {'outPort': getOutputs(nodesObj, graph.node(inputs[i])['meta'])[0], 'inPort': getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[0]})
    graph.setEdge(node, newNode, {'outPort': getOutputs(nodesObj, 'logic/' + nodeName.toLowerCase())[0], 'inPort': getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[1]})
    node = newNode
  }
  return {nodeId: nodeId, node: node}
}
