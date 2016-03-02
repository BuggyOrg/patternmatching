/* global describe, it */

var expect = require('chai').expect
var patternMatching = require('../src/pattern-matching.js')
var grlib = require('graphlib')
var fs = require('fs')

var expressionBig = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/testexpressionBig.graphlib')))
var expression = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/testexpression.graphlib')))
describe('', function () {
  it('Fibonacci expression', function () {
    return Promise.all([
      patternMatching.convert(expression)
    ]).then((result) => {
      var d = result[0]
      fs.writeFileSync('test/fixtures/testgraph.graphlib', JSON.stringify(grlib.json.write(d), null, 2))
      var curGraph = grlib.json.write(d)
      var cmpGraph = JSON.parse(fs.readFileSync('test/fixtures/testgraph.graphlib'))

      expect(curGraph).to.deep.equal(cmpGraph)
    })
  })

  it('MergeSort expression', function () {
    return Promise.all([
      patternMatching.convert(expressionBig)
    ]).then((result) => {
      var dBig = result[0]
      fs.writeFileSync('test/fixtures/testgraphBig.graphlib', JSON.stringify(grlib.json.write(dBig), null, 2))
      var curGraphBig = grlib.json.write(dBig)
      var cmpGraphBig = JSON.parse(fs.readFileSync('test/fixtures/testgraphBig.graphlib'))

      expect(curGraphBig).to.deep.equal(cmpGraphBig)
    })
  })
})
