export function convert (expression) {
  var fs = require('fs')
  var grlib = require('graphlib')
  // var componentLib = require('@buggyorg/component-library')
  // var compLib = componentLib.getComponentLibrary()
  var graph = expression
  var nodeId = 0
  var rules = expression.node('PARENT')['rules']
  var res
  var ruleTriple = []
  for (var rule = 0; rule < rules.length; rule++) {
    var numberOfConstants = 0
    var inputs = rules[rule]['inputs']
    var equalNodes = []
    for (var input = 0; input < inputs.length; input++) {
      if (inputs[input]['type'] === 'constant') {
        numberOfConstants++
        res = createEqualAndConst(inputs[input]['value'], inputs[input]['name'], nodeId, graph)
        nodeId = res['newNodeId']
        equalNodes.push(res['equalNode'])
        // TODO den equal node mit dem and gatter verbinden
      }
    }
    if (equalNodes.length > 1) {
      res = createAtomics(equalNodes, nodeId, graph, 'AND')
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
  console.log('Before:\n' + ruleTriple)
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
        res = createAtomics(orInputs, nodeId, graph, 'OR')
        nodeId = res['nodeId']
        lastOr = res['node']
        orInputs = [lastOr]
      }
      // create the not node
      var nodeNot = nodeId + '_NOT'
      nodeId++
      graph.setNode(nodeNot, {nodeType: 'process', meta: 'logic/not', type: 'atomic', parent: 'PARENT'})
      graph.setParent(nodeNot, 'PARENT')
      graph.setEdge(lastOr, nodeNot)
      if (ruleTriple[r]['numberOfConstants'] > 0) {
        // create the and node
        var nodeAnd = nodeId + '_AND'
        nodeId++
        graph.setNode(nodeAnd, {nodeType: 'process', meta: 'logic/and', type: 'atomic', parent: 'PARENT'})
        graph.setParent(nodeAnd, 'PARENT')
        graph.setEdge(nodeNot, nodeAnd)
        graph.setEdge(ruleTriple[r]['endBoolNode'], nodeAnd)
        ruleTriple[r]['endBoolNode'] = nodeAnd
      } else {
        ruleTriple[r]['endBoolNode'] = nodeNot
      }

      orInputs.push(ruleTriple[r]['endBoolNode'])
    }
  }
  console.log('After:\n' + ruleTriple)

  for (var ru = 0; ru < ruleTriple.length; ru++) {
    var outports = ruleTriple[ru]['rule']['outputs']
    for (var outport = 0; outport < outports.length; outport++) {
      var nodeDemux = nodeId + '_DEMUX'
      nodeId++
      graph.setNode(nodeDemux, {nodeType: 'process', meta: 'logic/demux', type: 'atomic', parent: 'PARENT'})
      graph.setParent(nodeDemux, 'PARENT')
      if (outports[outport]['type'] === 'constant') {
        var nodeConst = nodeId + '_CONST'
        nodeId++
        graph.setNode(nodeConst, {nodeType: 'process', meta: 'logic/const', type: 'atomic', parent: 'PARENT'})
        graph.setParent(nodeConst, 'PARENT')
        graph.setEdge(nodeConst, nodeDemux)
      } else {
        var inports = ruleTriple[ru]['rule']['inputs']
        for (var i = 0; i < inports.length; i++) {
          if (inports[i]['value'] === outports[outport]['value']) {
            graph.setEdge('PARENT', nodeDemux, inports[i]['name'])
          }
        }
      }
      graph.setEdge(ruleTriple[ru]['endBoolNode'], nodeDemux)
      graph.setEdge(nodeDemux, 'PARENT', outports[outport]['name'])
    }
  }
  fs.writeFileSync('test/fixtures/testgraphBig.graphlib', JSON.stringify(grlib.json.write(graph), null, 2))
  return graph
}

function createEqualAndConst (constValue, edgeName, nodeId, graph) {
  var nodeEqual = nodeId + '_EQUAL'
  nodeId++
  graph.setNode(nodeEqual, {nodeType: 'process', meta: 'logic/equal', type: 'atomic', parent: 'PARENT'})
  graph.setParent(nodeEqual, 'PARENT')
  graph.setEdge('PARENT', nodeEqual, edgeName)
  var nodeConst = nodeId + '_CONST'
  nodeId++
  graph.setNode(nodeConst, {nodeType: 'process', meta: 'logic/const', type: 'atomic', parent: 'PARENT'})
  graph.setParent(nodeConst, 'PARENT')
  graph.setEdge(nodeConst, nodeEqual)
  return {equalNode: nodeEqual, newNodeId: nodeId}
}

function createAtomics (inputs, nodeId, graph, nodeName) {
  if (inputs.length === 1) {
    return {nodeId: nodeId, node: inputs[0]}
  }
  var node = nodeId + '_' + nodeName
  nodeId++
  graph.setNode(node, {nodeType: 'process', meta: 'logic/' + nodeName.toLowerCase(), type: 'atomic', parent: 'PARENT'})
  graph.setParent(node, 'PARENT')
  graph.setEdge(inputs[0], node)
  graph.setEdge(inputs[1], node)
  for (var i = 2; i < inputs.length; i++) {
    var newNode = nodeId + '_' + nodeName
    nodeId++
    graph.setNode(newNode, {nodeType: 'process', meta: 'logic/' + nodeName.toLowerCase(), type: 'atomic', parent: 'PARENT'})
    graph.setParent(newNode, 'PARENT')
    graph.setEdge(inputs[i], newNode)
    graph.setEdge(node, newNode)
    node = newNode
  }
  return {nodeId: nodeId, node: node}
}
