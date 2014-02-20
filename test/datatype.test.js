var db, Model;

describe('datatypes', function (){

  before(function (done){
    db = getSchema();
    Model = db.define('Model', {
      str : String,
      date: Date,
      num : Number,
      bool: Boolean,
      list: {type: []}
    });

    db.automigrate()
    .then(function(){
      return Model.destroyAll();
    })
    .then(function(){
      return Model.create({str: 'hi', date: Date.now(), num: '1', bool: 0, list: ['tests']});
    })
    .done(function(){
      done();
    });
  });

  it('should keep types when get read data from db', function (done){
    var d = new Date(), id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, list: ['test']
    }).then(function (m){
      expect(m.id).to.be.ok();
      expect(m.str).to.be.a('string');
      expect(m.num).to.be.a('number');
      expect(m.bool).to.be.a('boolean');
      id = m.id;
      testFind().then(testOne).done(done);
    }, function(){
      expect(function(){
        throw new Error('This should not be called');
      }).to.not.throwError();
    }).done();

    function testFind(){
      return Model.find(id).then(function (m){
        expect(m).to.be.ok();
        expect(m.str).to.be.a('string');
        expect(m.num).to.be.a('number');
        expect(m.bool).to.be.a('boolean');
        expect(m.date).to.be.a(Date);
        expect(m.date.toString()).to.equal(d.toString(), 'Time must match');
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      });
    }

    function testOne(){
      return Model.findOne().then(function (m){
        expect(m).to.be.ok();
        expect(m.str).to.be.a('string');
        expect(m.num).to.be.a('number');
        expect(m.bool).to.be.a('boolean');
        expect(m.date).to.be.a(Date);
        expect(m.date.toString()).to.equal(d.toString(), 'Time must match');
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      });
    }
  });

  it('should convert "false" to false for boolean', function (){
    var m = new Model({bool: 'false'});
    expect(m.bool).to.equal(false);
  });

});
