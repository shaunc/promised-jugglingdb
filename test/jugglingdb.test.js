var jugglingdb = require('../');

describe('jugglingdb', function (){
  it('should expose version', function (){
    expect(jugglingdb.version).to.equal(require('../package.json').version);
  });
});
