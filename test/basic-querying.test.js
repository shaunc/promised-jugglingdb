var db, User;

describe('basic-querying', function (){

  before(function (done){
    db = getSchema();

    User = db.define('User', {
      name : {type: String, sort: true, limit: 100},
      email: {type: String, index: true, limit: 100},
      role : {type: String, index: true, limit: 100},
      order: {type: Number, index: true, sort: true, limit: 100}
    });

    db.automigrate(done);

  });

  describe('find', function (){

    before(function (done){
      User.destroyAll(done);
    });

    it('should query by id: not found', function (done){
      User.find(1, function (err, u){
        expect(u).to.not.be.ok();
        expect(err).to.not.be.ok();
        done();
      });
    });

    it('should query by id: found', function (done){
      User.create(function (err, u){
        expect(err).to.not.be.ok();
        expect(u.id).to.be.ok();
        User.find(u.id, function (err, u){
          expect(u).to.be.ok();
          expect(err).to.not.be.ok();
          expect(u).to.be.a(User);
          done();
        });
      });
    });

  });

  describe('all', function (){

    before(seed);

    it('should query collection', function (done){
      User.all(function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        expect(users).to.have.length(6);
        done();
      });
    });

    it('should query limited collection', function (done){
      User.all({limit: 3}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        expect(users).to.have.length(3);
        done();
      });
    });

    it('should query offset collection with limit', function (done){
      User.all({skip: 1, limit: 4}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        expect(users).to.have.length(4);
        done();
      });
    });

    it('should query filtered collection', function (done){
      User.all({where: {role: 'lead'}}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        expect(users).to.have.length(2);
        done();
      });
    });

    it('should query collection sorted by numeric field', function (done){
      User.all({order: 'order'}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        users.forEach(function (u, i){
          expect(u.order).to.be(i + 1);
        });
        done();
      });
    });

    it('should query collection desc sorted by numeric field', function (done){
      User.all({order: 'order DESC'}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        users.forEach(function (u, i){
          expect(u.order).to.be(users.length - i);
        });
        done();
      });
    });

    it('should query collection sorted by string field', function (done){
      User.all({order: 'name'}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        expect(users.shift().name).to.equal('George Harrison');
        expect(users.shift().name).to.equal('John Lennon');
        expect(users.pop().name).to.equal('Stuart Sutcliffe');
        done();
      });
    });

    it('should query collection desc sorted by string field', function (done){
      User.all({order: 'name DESC'}, function (err, users){
        expect(users).to.be.ok();
        expect(err).to.not.be.ok();
        expect(users.pop().name).to.equal('George Harrison');
        expect(users.pop().name).to.equal('John Lennon');
        expect(users.shift().name).to.equal('Stuart Sutcliffe');
        done();
      });
    });

  });

  describe('count', function (){

    before(seed);

    it('should query total count', function (done){
      User.count(function (err, n){
        expect(err).to.not.be.ok();
        expect(n).to.be.ok();
        expect(n).to.equal(6);
        done();
      });
    });

    it('should query filtered count', function (done){
      User.count({role: 'lead'}, function (err, n){
        expect(err).to.not.be.ok();
        expect(n).to.be.ok();
        expect(n).to.equal(2);
        done();
      });
    });
  });

  describe('findOne', function (){

    before(seed);

    it('should find first record (default sort by id)', function (done){
      User.all({order: 'id'}, function (err, users){
        User.findOne(function (e, u){
          expect(e).to.not.be.ok();
          expect(u).to.be.ok();
          expect(u.id.toString()).to.equal(users[0].id.toString());
          done();
        });
      });
    });

    it('should find first record', function (done){
      User.findOne({order: 'order'}, function (e, u){
        expect(e).to.not.be.ok();
        expect(u).to.be.ok();
        expect(u.order).to.equal(1);
        expect(u.name).to.equal('Paul McCartney');
        done();
      });
    });

    it('should find last record', function (done){
      User.findOne({order: 'order DESC'}, function (e, u){
        expect(e).to.not.be.ok();
        expect(u).to.be.ok();
        expect(u.order).to.equal(6);
        expect(u.name).to.equal('Ringo Starr');
        done();
      });
    });

    it('should find last record in filtered set', function (done){
      User.findOne({
        where: {role: 'lead'},
        order: 'order DESC'
      }, function (e, u){
        expect(e).to.not.be.ok();
        expect(u).to.be.ok();
        expect(u.order).to.equal(2);
        expect(u.name).to.equal('John Lennon');
        done();
      });
    });

    it('should work even when find by id', function (done){
      User.findOne(function (e, u){
        User.findOne({where: {id: u.id}}, function (err, user){
          expect(err).to.not.be.ok();
          expect(user).to.be.ok();
          done();
        });
      });
    });

  });

  describe('exists', function (){

    before(seed);

    it('should check whether record exist', function (done){
      User.findOne(function (e, u){
        User.exists(u.id, function (err, exists){
          expect(err).to.not.be.ok();
          expect(exists).to.be.ok();
          done();
        });
      });
    });

    it('should check whether record not exist', function (done){
      User.destroyAll(function (){
        User.exists(42, function (err, exists){
          expect(err).to.not.be.ok();
          expect(exists).to.not.be.ok();
          done();
        });
      });
    });

  });

});

function seed(done){
  var count = 0;
  var beatles = [
    {
      name : 'John Lennon',
      mail : 'john@b3atl3s.co.uk',
      role : 'lead',
      order: 2
    },
    {
      name : 'Paul McCartney',
      mail : 'paul@b3atl3s.co.uk',
      role : 'lead',
      order: 1
    },
    {name: 'George Harrison', order: 5},
    {name: 'Ringo Starr', order: 6},
    {name: 'Pete Best', order: 4},
    {name: 'Stuart Sutcliffe', order: 3}
  ];
  User.destroyAll(function (){
    beatles.forEach(function (beatle){
      User.create(beatle, ok);
    });
  });

  function ok(){
    if (++count === beatles.length) {
      done();
    }
  }
}
