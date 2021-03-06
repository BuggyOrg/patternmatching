/* global describe, it */

var expect = require('chai').expect
var patternMatching = require('../src/pattern-matching.js')
var fs = require('fs')

var expressionBig = JSON.parse(fs.readFileSync('test/fixtures/testexpressionBig.graphlib'))
var expression = JSON.parse(fs.readFileSync('test/fixtures/testexpression.graphlib'))
var expressionLisgy = JSON.parse(fs.readFileSync('test/fixtures/testLisgy.graphlib'))

describe('Pattern Matching', () => {
  it('Fibonacci expression', function () {
    return Promise.all([
      patternMatching.convert(expression)
    ]).then((result) => {
      var curGraph = result[0]
      // fs.writeFileSync('test/fixtures/testgraph.graphlib', JSON.stringify(curGraph, null, 2))
      var cmpGraph = JSON.parse(fs.readFileSync('test/fixtures/testgraph.graphlib'))

      expect(curGraph).to.deep.equal(cmpGraph)
    })
  })

  it('MergeSort expression', function () {
    return Promise.all([
      patternMatching.convert(expressionBig)
    ]).then((result) => {
      var curGraphBig = result[0]
      // fs.writeFileSync('test/fixtures/testgraphBig.graphlib', JSON.stringify(curGraphBig, null, 2))
      var cmpGraphBig = JSON.parse(fs.readFileSync('test/fixtures/testgraphBig.graphlib'))

      expect(curGraphBig).to.deep.equal(cmpGraphBig)
    })
  })

  it('Expression from Lisgy', function () {
    return Promise.all([
      patternMatching.convert(expressionLisgy)
    ]).then((result) => {
      var curGraph = result[0]
      // fs.writeFileSync('test/fixtures/testLisgy_result.graphlib', JSON.stringify(curGraph, null, 2))
      var cmpGraph = JSON.parse(fs.readFileSync('test/fixtures/testLisgy_result.graphlib'))
      expect(curGraph).to.deep.equal(cmpGraph)
    })
  })

  it('Expression from buggy-cli', function () {
    return Promise.all([
      patternMatching.convert(JSON.parse(fs.readFileSync('test/fixtures/match_fnInput.json')))
    ]).then((result) => {
      var curGraph = result[0]
      fs.writeFileSync('test/fixtures/test_result.graphlib', JSON.stringify(curGraph, null, 2))
      var cmpGraph = JSON.parse(fs.readFileSync('test/fixtures/test_result.graphlib'))
      expect(curGraph).to.deep.equal(cmpGraph)
    })
  })
})
