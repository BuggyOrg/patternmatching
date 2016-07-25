import libConnection from '@buggyorg/component-library'
import _ from 'lodash'
var compLib = libConnection('http://quasar:9200')

function getInputs (nodesObj, meta) {
  return Object.keys(nodesObj[meta]['inputPorts'])
}

function getOutputs (nodesObj, meta) {
  return Object.keys(nodesObj[meta]['outputPorts'])
}

function getMeta (nodes, node) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].name === node) {
      return nodes[i].meta
    }
  }
  return
}

var nodesIds = [
  {id: 'logic/equal', version: '0.1.0'},
  {id: 'logic/and', version: '0.1.0'},
  {id: 'logic/or', version: '0.1.0'},
  {id: 'logic/not', version: '0.1.0'},
  {id: 'logic/demux', version: '0.1.0'},
  {id: 'math/const', version: '0.1.0'},
  {id: 'control/consume', version: '0.1.0'}
]

export function convert (expression) {
  var nodesPromise = nodesIds.map(node => {
    return compLib.get(node.id, node.version)
  })

  return Promise.all(nodesPromise).then((nodesArr) => {
    var nodesObj = _.keyBy(nodesArr, 'id')

    var graph = expression
    for (let i = 0; i < graph.nodes.length; i++) {
      graph.nodes[i] = convertNode(graph.nodes[i], nodesObj)
    }
    return graph
  }).catch(function (err) { console.error(err) })
}

function convertNode (node, nodesObj) {
  if (node.implementation) {
    node.implementation = convertNode(node.implementation, nodesObj)
  }
  if (node.value && node.value.implementation) {
    for (let i = 0; i < node.value.implementation.nodes.length; i++) {
      node.value.implementation.nodes[i] = convertNode(node.value.implementation.nodes[i], nodesObj)
    }
  }
  if ((node.name !== undefined && node.name.includes('mrules')) || (node.v !== undefined && node.v.includes('mrules'))) {
    var matchNode = node
    var newMatchNode = {}
    newMatchNode['v'] = matchNode.v || matchNode.name
    newMatchNode['value'] = {}
    var allRules = matchNode.rules || matchNode.value.rules
    newMatchNode['value']['id'] = matchNode.id || matchNode.value.id || newMatchNode['v']
    newMatchNode['value']['nodeType'] = 'process'
    newMatchNode['value']['atomic'] = false
    newMatchNode['value']['inputPorts'] = matchNode.inputPorts || matchNode.value.inputPorts || {}
    newMatchNode['value']['outputPorts'] = matchNode.outputPorts || matchNode.value.outputPorts || {}
    newMatchNode['value']['implementation'] = {}
    var innerGraph = {'nodes': [], 'edges': []}
    var nodeId = 0
    var res
    var ruleTriple = []
    for (var rule = 0; rule < allRules.length; rule++) {
      var numberOfConstants = 0
      var inputs = allRules[rule]['inputs']
      var equalNodes = []
      for (var input = 0; input < inputs.length; input++) {
        if (!inputs[input]['variable']) {
          numberOfConstants++
          res = createEqualAndConst(inputs[input]['value/const'], inputs[input]['name'], inputs[input]['type'], nodeId, innerGraph, nodesObj, newMatchNode)
          nodeId = res['newNodeId']
          equalNodes.push(res['equalNode'])
        }
      }
      if (equalNodes.length > 1) {
        res = createAtomics(equalNodes, nodeId, innerGraph, 'AND', nodesObj)
        nodeId = res['nodeId']
        ruleTriple.push({rule: allRules[rule], numberOfConstants: numberOfConstants, endBoolNode: res['node']})
      } else if (equalNodes.length === 1) {
        ruleTriple.push({rule: allRules[rule], numberOfConstants: numberOfConstants, endBoolNode: equalNodes[0]})
      } else {
        ruleTriple.push({rule: allRules[rule], numberOfConstants: numberOfConstants, endBoolNode: null})
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
          res = createAtomics(orInputs, nodeId, innerGraph, 'OR', nodesObj)
          nodeId = res['nodeId']
          lastOr = res['node']
          orInputs = [lastOr]
        }
        // create the not node
        var nodeNot = nodeId + '_NOT'
        nodeId++
        innerGraph.nodes.push({'name': nodeNot, 'meta': 'logic/not'})

        innerGraph.edges.push({'from': lastOr + ':' + getOutputs(nodesObj, 'logic/or')[0], 'to': nodeNot + ':' + getInputs(nodesObj, 'logic/not')[0]})
        if (ruleTriple[r]['numberOfConstants'] > 0) {
          // create the and node
          var nodeAnd = nodeId + '_AND'
          nodeId++
          innerGraph.nodes.push({'name': nodeAnd, 'meta': 'logic/and'})
          innerGraph.edges.push({'from': nodeNot + ':' + getOutputs(nodesObj, 'logic/not')[0], 'to': nodeAnd + ':' + getInputs(nodesObj, 'logic/and')[0]})
          innerGraph.edges.push({'from': ruleTriple[r]['endBoolNode'] + ':' + getOutputs(nodesObj, getMeta(innerGraph.nodes, ruleTriple[r]['endBoolNode']))[0], 'to': nodeAnd + ':' + getInputs(nodesObj, 'logic/and')[1]})
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
        if (!outports[outport]['variable']) {
          innerGraph.nodes.push({'name': nodeDemux, 'meta': 'logic/demux'})
          var nodeConst = nodeId + '_CONST'
          nodeId++
          innerGraph.nodes.push({'name': nodeConst, 'meta': 'math/const', 'params': {'value': outports[outport]['value/const']}})
          innerGraph.edges.push({'from': nodeConst + ':' + getOutputs(nodesObj, 'math/const')[0], 'to': nodeDemux + ':' + getInputs(nodesObj, 'logic/demux')[0]})
        } else {
          innerGraph.nodes.push({'name': nodeDemux, 'meta': 'logic/demux'})
          var inports = ruleTriple[ru]['rule']['inputs']
          for (let i = 0; i < inports.length; i++) {
            if (inports[i].name === outports[outport].value) {
              innerGraph.edges.push({'from': inports[i]['name'], 'to': nodeDemux + ':' + getInputs(nodesObj, 'logic/demux')[0]})
              newMatchNode.value.inputPorts[inports[i]['name']] = inports[i]['type']
            }
          }
        }
        innerGraph.edges.push({'from': ruleTriple[ru]['endBoolNode'] + ':' + getOutputs(nodesObj, getMeta(innerGraph.nodes, ruleTriple[ru]['endBoolNode']))[0], 'to': nodeDemux + ':' + getInputs(nodesObj, 'logic/demux')[1]})
        innerGraph.edges.push({'from': nodeDemux + ':' + getOutputs(nodesObj, 'logic/demux')[0], 'to': outports[outport]['name']})
        var nodeConsume = nodeId + '_CONSUME'
        nodeId++
        innerGraph.nodes.push({'name': nodeConsume, 'meta': 'control/consume'})
        innerGraph.edges.push({'from': nodeDemux + ':' + getOutputs(nodesObj, 'logic/demux')[1], 'to': nodeConsume + ':' + getInputs(nodesObj, 'control/consume')[0]})
        newMatchNode.value.outputPorts[outports[outport]['name']] = outports[outport]['type']
      }
    }
    newMatchNode.value.implementation = innerGraph
    node = newMatchNode
  }
  return node
}

function createEqualAndConst (constValue, edgeName, edgeType, nodeId, innerGraph, nodesObj, matchNode) {
  var nodeEqual = nodeId + '_EQUAL'
  nodeId++
  innerGraph.nodes.push({'name': nodeEqual, 'meta': 'logic/equal'})
  innerGraph.edges.push({'from': edgeName, 'to': nodeEqual + ':' + getInputs(nodesObj, 'logic/equal')[0]})
  var nodeConst = nodeId + '_CONST'
  nodeId++
  innerGraph.nodes.push({'name': nodeConst, 'meta': 'math/const', 'params': {'value': constValue}})
  innerGraph.edges.push({'from': nodeConst + ':' + getOutputs(nodesObj, 'math/const')[0], 'to': nodeEqual + ':' + getInputs(nodesObj, 'logic/equal')[1]})
  matchNode.value.inputPorts[edgeName] = edgeType
  return {equalNode: nodeEqual, newNodeId: nodeId}
}

function createAtomics (inputs, nodeId, innerGraph, nodeName, nodesObj) {
  if (inputs.length === 1) {
    return {nodeId: nodeId, node: inputs[0]}
  }
  var node = nodeId + '_' + nodeName
  nodeId++
  innerGraph.nodes.push({'name': node, 'meta': 'logic/' + nodeName.toLowerCase()})
  innerGraph.edges.push({'from': inputs[0] + ':' + getOutputs(nodesObj, getMeta(innerGraph.nodes, inputs[0]))[0], 'to': node + ':' + getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[0]})
  innerGraph.edges.push({'from': inputs[1] + ':' + getOutputs(nodesObj, getMeta(innerGraph.nodes, inputs[1]))[0], 'to': node + ':' + getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[1]})
  for (var i = 2; i < inputs.length; i++) {
    var newNode = nodeId + '_' + nodeName
    nodeId++
    innerGraph.nodes.push({'name': newNode, 'meta': 'logic/' + nodeName.toLowerCase()})
    innerGraph.edges.push({'from': inputs[i] + ':' + getOutputs(nodesObj, getMeta(innerGraph.nodes, inputs[i]))[0], 'to': newNode + ':' + getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[0]})
    innerGraph.edges.push({'from': node + ':' + getOutputs(nodesObj, 'logic/' + nodeName.toLowerCase())[0], 'to': newNode + ':' + getInputs(nodesObj, 'logic/' + nodeName.toLowerCase())[1]})
    node = newNode
  }
  return {nodeId: nodeId, node: node}
}
