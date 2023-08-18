// Copyright (c)2023 Quinn Michaels
// YouTube Deva test file

const {expect} = require('chai')
const youtube = require('./index.js');

describe(youtube.me.name, () => {
  beforeEach(() => {
    return youtube.init()
  });
  it('Check the SVARGA Object', () => {
    expect(youtube).to.be.an('object');
    expect(youtube).to.have.property('me');
    expect(youtube).to.have.property('vars');
    expect(youtube).to.have.property('listeners');
    expect(youtube).to.have.property('methods');
    expect(youtube).to.have.property('modules');
  });
})
