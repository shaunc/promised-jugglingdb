var db = getSchema();

describe('defaults', function (){
  var Server;

  before(function (){
    Server = db.define('Server', {
      host: String,
      port: {type: Number, default: 80}
    });
  });

  it('should apply defaults on new', function (){
    var s = new Server();
    expect(s.port).to.equal(80);
  });

  it('should apply defaults on create', function (done){
    Server.create().then(function (s){
      expect(s.port).to.equal(80);
    }, function(){
      expect(function(){
        throw new Error('This should not be called');
      }).to.not.throwError();
    }).done(done);
  });

  it('should apply defaults on read', function (done){
    db.defineProperty('Server', 'host', {
      type   : String,
      default: 'localhost'
    });
    Server.all().then(function(servers){
      expect(servers[0].host).to.equal('localhost');
    }, function(){
      expect(function(){
        throw new Error('This should not be called');
      }).to.not.throwError();
    }).done(done);
  });
});
