// This test written in mocha+should.js
var j = require('../'), db, User;
var ValidationError = require('../lib/validations.js').ValidationError;

function getValidAttributes(){
  return {
    name           : 'Maria',
    email          : 'email@example.com',
    state          : '',
    bio            : 'haha',
    age            : 26,
    countryCode    : 'RU',
    gender         : 'female',
    createdByAdmin : false,
    createdByScript: true
  };
}

describe('validations', function (){

  before(function (done){
    db = getSchema();
    User = db.define('User', {
      email          : String,
      name           : String,
      password       : String,
      state          : String,
      age            : Number,
      bio            : String,
      gender         : String,
      domain         : String,
      countryCode    : String,
      pendingPeriod  : Number,
      createdByAdmin : Boolean,
      createdByScript: Boolean,
      updatedAt      : Date
    });
    db.automigrate().done(done);
  });

  beforeEach(function (done){
    User.destroyAll().then(function (){
      delete User._validations;
    }).done(done);
  });

  after(function (done){
    db.disconnect().done(done);
  });

  describe('commons', function (){

    describe('skipping', function (){

      it('should allow to skip using if: attribute', function (){
        User.validatesPresenceOf('pendingPeriod', {if: 'createdByAdmin'});
        var user = new User();
        user.createdByAdmin = true;
        expect(user.isValid()).to.be(false);
        expect(user.errors.pendingPeriod).to.eql(['can\'t be blank']);
        user.pendingPeriod = 1;
        expect(user.isValid()).to.be(true);
      });

    });

    describe('lifecycle', function (){

      it('should work on create', function (done){
        delete User._validations;
        User.validatesPresenceOf('name');
        User.create(function (e, u){
          expect(e).to.be.ok();
          User.create({name: 'Valid'}, function (e, d){
            expect(e).to.not.be.ok();
            done();
          });
        });
      });

      it('should work on update', function (done){
        delete User._validations;
        User.validatesPresenceOf('name');
        User.create({name: 'Valid'}, function (e, d){
          d.updateAttribute('name', null, function (e){
            expect(e).to.be.ok();
            expect(e).to.be.a(Error);
            expect(e).to.be.a(ValidationError);
            d.updateAttribute('name', 'Vasiliy', function (e){
              expect(e).to.not.be.ok();
              done();
            });
          })
        });
      });

      it('should return error code', function (done){
        delete User._validations;
        User.validatesPresenceOf('name');
        User.create(function (e, u){
          expect(e).to.be.ok();
          expect(e.codes.name).to.eql(['presence']);
          done();
        });
      });

      it('should allow to modify error after validation', function (done){
        User.afterValidate = function (next){
          next();
        };
        done();
      });

    });
  });

  describe('presence', function (){

    it('should validate presence', function (){
      User.validatesPresenceOf('name', 'email');
      var u = new User();
      expect(u.isValid()).to.be(false);
      u.name = 1;
      u.email = 2;
      expect(u.isValid()).to.be(true);
    });

    it('should skip validation by property (if/unless)', function (){
      User.validatesPresenceOf('domain', {unless: 'createdByScript'});

      var user = new User(getValidAttributes());
      expect(user.isValid()).to.be(true);

      user.createdByScript = false;
      expect(user.isValid()).to.be(false);
      expect(user.errors.domain).to.eql(['can\'t be blank']);

      user.domain = 'domain';
      expect(user.isValid()).to.be(true);
    });

  });

  describe('uniqueness', function (){
    it('should validate uniqueness', function (done){
      var i = 0;
      User.validatesUniquenessOf('email');
      var u = new User({email: 'hey'});
      var isValid = u.isValid(function (valid){
        expect(valid).to.be(true);
        u.save(function (){
          var u2 = new User({email: 'hey'});
          u2.isValid(function (valid){
            expect(valid).to.be(false);
            done();
          });
        });
      });
      expect(isValid).to.be.an('undefined');
    });

    it('should correctly handle null values', function (done){
      User.validatesUniquenessOf('email', {allowNull: true});
      var u = new User({email: null});
      var isValid = u.isValid(function (valid){
        expect(valid).to.be(true);
        u.save(function (){
          var u2 = new User({email: null});
          u2.isValid(function (valid){
            expect(valid).to.be(true);
            done();
          });
        });
      });
      expect(isValid).to.be.an('undefined');
    });

    it('should handle same object modification', function (done){
      User.validatesUniquenessOf('email');
      var u = new User({email: 'hey'});
      var isValid = u.isValid(function (valid){
        expect(valid).to.be(true);
        u.save(function (){
          u.name = 'Goghi';
          u.isValid(function (valid){
            expect(valid).to.be(true);
            u.save(done);
          });
        });
      });
      // async validations always falsy when called as sync
      expect(isValid).to.be.an('undefined');
    });

  });

  describe('format', function (){
    it('should validate format');
    it('should overwrite default blank message with custom format message');
  });

  describe('numericality', function (){
    it('should validate numericality');
  });

  describe('inclusion', function (){
    it('should validate inclusion');
  });

  describe('exclusion', function (){
    it('should validate exclusion');
  });

  describe('length', function (){
    it('should validate max length', function (done){
      User.validatesLengthOf('gender', {max: 6});
      var u = new User(getValidAttributes());
      u.isValid(function (valid){
        expect(u.errors).to.not.be.ok();
        expect(valid).to.be(true);
        u.gender = 'undefined';
        u.isValid(function (valid){
          expect(u.errors).to.be.ok();
          expect(valid).to.be(false);
          done();
        });
      });
    });

    it('should validate min length', function (done){
      User.validatesLengthOf('bio', {min: 3});
      var u = new User({bio: 'ha'});
      u.isValid(function (valid){
        expect(u.errors).to.be.ok();
        expect(valid).to.be(false);
        u.bio = 'undefined';
        u.isValid(function (valid){
          expect(u.errors).to.not.be.ok();
          expect(valid).to.be(true);
          done();
        });
      });
    });

    it('should validate exact length', function (done){
      User.validatesLengthOf('countryCode', {is: 2});
      var u = new User(getValidAttributes());
      u.isValid(function (valid){
        expect(u.errors).to.not.be.ok();
        expect(valid).to.be(true);
        u.countryCode = 'RUS';
        u.isValid(function (valid){
          expect(u.errors).to.be.ok();
          expect(valid).to.be(false);
          done();
        });
      });
    });
  });

  describe('custom', function (){
    it('should validate using custom sync validation');
    it('should validate using custom async validation');
  });
});
