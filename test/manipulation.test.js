var db, Person;

describe('manipulation', function (){

  before(function (done){
    db = getSchema();

    Person = db.define('Person', {
      name     : {type: String, name: 'full_name'},
      gender   : String,
      married  : Boolean,
      age      : {type: Number, index: true},
      dob      : Date,
      createdAt: {type: Number, default: Date.now, name: 'created_at'}
    });

    db.automigrate(done);

  });

  describe('create', function (){

    before(function (done){
      Person.destroyAll(done);
    });

    it('should create instance', function (done){
      Person.create({name: 'Anatoliy'}, function (err, p){
        expect(p.name).to.equal('Anatoliy');
        expect(err).to.not.be.ok();
        expect(p).to.be.ok();
        Person.find(p.id, function (err, person){
          expect(person.id).to.equal(p.id);
          expect(person.name).to.equal('Anatoliy');
          done();
        });
      });
    });

    it('should return instance of object', function (done){
      var person = Person.create(function (err, p){
        expect(p.id).to.eql(person.id);
        done();
      });
      expect(person).to.be.ok();
      expect(person).to.be.a(Person);
      expect(person.id).to.not.be.ok();
    });

    it('should work when called without callback', function (done){
      Person.afterCreate = function (next){
        expect(this).to.be.a(Person);
        expect(this.name).to.equal('Nickolay');
        expect(this.id).to.be.ok();
        Person.afterCreate = null;
        next();
        setTimeout(done, 10);
      };
      Person.create({name: 'Nickolay'});
    });

    it('should create instance with blank data', function (done){
      Person.create(function (err, p){
        expect(err).to.not.be.ok();
        expect(p).to.be.ok();
        expect(p.name).to.not.be.ok();
        Person.find(p.id, function (err, person){
          expect(person.id).to.equal(p.id);
          expect(person.name).to.not.be.ok();
          done();
        });
      });
    });

    it('should work when called with no data and callback', function (done){
      Person.afterCreate = function (next){
        expect(this).to.be.a(Person);
        expect(this.name).to.not.be.ok();
        expect(this.id).to.be.ok();
        Person.afterCreate = null;
        next();
        setTimeout(done, 30);
      };
      Person.create();
    });

    it('should create batch of objects', function (done){
      var batch = [
        {name: 'Shaltay'},
        {name: 'Boltay'},
        {}
      ];
      expect(Person.create(batch, function (e, ps){
        expect(e).to.not.be.ok();
        expect(ps).to.be.ok();
        expect(ps).to.be.an('array');
        expect(ps).to.have.length(batch.length);

        Person.validatesPresenceOf('name');
        expect(Person.create(batch, function (errors, persons){
          delete Person._validations;
          expect(errors).to.be.ok();
          expect(errors).to.have.length(batch.length);
          expect(errors[0]).to.not.be.ok();
          expect(errors[1]).to.not.be.ok();
          expect(errors[2]).to.be.ok();

          expect(persons).to.be.ok();
          expect(persons).to.have.length(batch.length);
          expect(persons[0].errors).to.not.be.ok();
          done();
        })).to.be.an('array');
      })).to.have.length(3);
    });
  });

  describe('save', function (){

    it('should save new object', function (done){
      var p = new Person;
      p.save(function (err){
        expect(err).to.not.be.ok();
        expect(p.id).to.be.ok();
        done();
      });
    });

    it('should save existing object', function (done){
      Person.findOne(function (err, p){
        expect(err).to.not.be.ok();
        p.name = 'Hans';
        expect(p.propertyChanged('name')).to.be(true);
        p.save(function (err){
          expect(err).to.not.be.ok();
          expect(p.propertyChanged('name')).to.be(false);
          Person.findOne(function (err, p){
            expect(err).to.not.be.ok();
            expect(p.name).to.equal('Hans');
            expect(p.propertyChanged('name')).to.be(false);
            done();
          });
        });
      });
    });

    it('should save invalid object (skipping validation)', function (done){
      Person.findOne(function (err, p){
        expect(err).to.not.be.ok();
        p.isValid = function (done){
          process.nextTick(done);
          return false;
        };
        p.name = 'Nana';
        p.save(function (err){
          expect(err).to.be.ok();
          expect(p.propertyChanged('name')).to.be(true);
          p.save({validate: false}, function (err){
            expect(err).to.not.be.ok();
            expect(p.propertyChanged('name')).to.be(false);
            done();
          });
        });
      });
    });

    it('should save invalid new object (skipping validation)', function (done){
      var p = new Person();
      expect(p.isNewRecord()).to.be(true);

      p.isValid = function (done){
        if (done) {
          process.nextTick(done);
        }
        return false;
      };
      expect(p.isValid()).to.be(false);

      p.save({ validate: false }, function (err){
        expect(err).to.not.be.ok();
        expect(p.isNewRecord()).to.be(false);
        expect(p.isValid()).to.be(false);
        done();
      });
    });

    it('should save throw error on validation', function (){
      Person.findOne(function (err, p){
        expect(err).to.not.be.ok();
        p.isValid = function (cb){
          cb(false);
          return false;
        };
        expect(function (){
          p.save({
            'throws': true
          });
        }).to.throwError('Validation error');
      });
    });

    it('should save with custom fields', function (){
      Person.create({name: 'Anatoliy'}, function (err, p){
        expect(p.id).to.be.ok();
        expect(p.name).to.be.ok();
        expect(p['full_name']).to.not.be.ok();
        var storedObj = JSON.parse(db.adapter.cache.Person[p.id]);
        expect(storedObj['full_name']).to.be.ok();
      });
    });

  });

  describe('updateAttributes', function (){
    var person;

    before(function (done){
      Person.destroyAll(function (){
        person = Person.create(done);
      });
    });

    it('should update one attribute', function (done){
      person.updateAttribute('name', 'Paul Graham', function (err, p){
        expect(err).to.not.be.ok();
        Person.all(function (e, ps){
          expect(err).to.not.be.ok();
          expect(ps).to.have.length(1);
          expect(ps.pop().name).to.equal('Paul Graham');
          done();
        });
      });
    });
  });

  describe('destroy', function (){

    it('should destroy record', function (done){
      Person.create(function (err, p){
        p.destroy(function (err){
          expect(err).to.not.be.ok();
          Person.exists(p.id, function (err, ex){
            expect(ex).to.not.be.ok();
            done();
          });
        });
      });
    });

    it('should destroy all records', function (done){
      Person.destroyAll(function (err){
        expect(err).to.not.be.ok();
        Person.all(function (err, posts){
          expect(posts).to.have.length(0);
          Person.count(function (err, count){
            expect(count).to.be(0);
            done();
          });
        });
      });
    });

    // TODO: implement destroy with filtered set
    it('should destroy filtered set of records');
  });

  describe('iterate', function (){

    before(function (next){
      var ps = [];
      for (var i = 0; i < 507; i += 1) {
        ps.push({name: 'Person ' + i});
      }
      Person.create(ps, next);
    });

    it('should iterate through the batch of objects', function (done){
      var num = 0;
      Person.iterate({batchSize: 100}, function (person, next, i){
        num += 1;
        next();
      }, function (err){
        expect(num).to.equal(507);
        done();
      });
    });

    it('should take limit into account', function (done){
      var num = 0;
      Person.iterate({batchSize: 20, limit: 21}, function (person, next, i){
        num += 1;
        next();
      }, function (err){
        expect(num).to.equal(21);
        done();
      });
    });

    it('should process in concurrent mode', function (done){
      var num = 0, time = Date.now();
      Person.iterate({batchSize: 10, limit: 21, concurrent: true}, function (person, next, i){
        num += 1;
        setTimeout(next, 20);
      }, function (err){
        expect(num).to.equal(21);
        expect(Date.now() - time).to.be.below(100);
        done();
      });
    });
  });

  describe('initialize', function (){
    it('should initialize object properly', function (){
      var hw = 'Hello word',
        now = Date.now(),
        person = new Person({name: hw});

      expect(person.name).to.equal(hw);
      expect(person.propertyChanged('name')).to.be(false);
      person.name = 'Goodbye, Lenin';
      expect(person.name_was).to.equal(hw);
      expect(person.propertyChanged('name')).to.be(true);
      expect(person.createdAt >= now).to.be(true);
      expect(person.isNewRecord()).to.be(true);
    });

    it('should work when constructor called as function', function (){
      var p = Person({name: 'John Resig'});
      expect(p).to.be.a(Person);
      expect(p.name).to.equal('John Resig');
    });
  });
});
