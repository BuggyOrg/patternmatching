/* global describe, it */

var expect = require('chai').expect
var patternMatching = require('../src/pattern-matching.js')
var grlib = require('graphlib')
var fs = require('fs')

var expressionBig = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/testexpressionBig.graphlib')))
var expression = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/testexpression.graphlib')))
describe('', function () {
  it('', function () {
    var d = patternMatching.convert(expression)
    var dBig = patternMatching.convert(expressionBig)
    // fs.writeFileSync('test/fixtures/testgraph.graphlib', JSON.stringify(grlib.json.write(d), null, 2))
    // fs.writeFileSync('test/fixtures/testgraphBig.graphlib', JSON.stringify(grlib.json.write(dBig), null, 2))
    var curGraph = grlib.json.write(d)
    var curGraphBig = grlib.json.write(dBig)
    var cmpGraph = JSON.parse(fs.readFileSync('test/fixtures/testgraph.graphlib'))
    var cmpGraphBig = JSON.parse(fs.readFileSync('test/fixtures/testgraphBig.graphlib'))

    expect(curGraph).to.deep.equal(cmpGraph)
    expect(curGraphBig).to.deep.equal(cmpGraphBig)
  })
})
