/* global describe, it */

var expect = require('chai').expect
var patternMatching = require('../src/pattern-matching.js')
var grlib = require('graphlib')
var fs = require('fs')

var expression = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/testexpressionBig.graphlib')))
describe('', function () {
  it('', function () {
    var d = patternMatching.convert(expression)
    fs.writeFileSync('testgraph.graphlib', JSON.stringify(grlib.json.write(d), null, 2))
    var curGraph = grlib.json.write(d)
    var cmpGraph = JSON.parse(fs.readFileSync('test/fixtures/testgraph.graphlib'))

    expect(curGraph).to.deep.equal(cmpGraph)
  })
})
