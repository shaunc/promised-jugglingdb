var db, User;

describe('i18n', function (){
  db = getSchema();

  before(function (){

    User = db.define('User', {
      email: {type: String, index: true, limit: 100},
      name : String
    });

    User.i18n = {
      en: {
        validation: {
          name : {
            presence: 'User name is not present'
          },
          email: {
            presence  : 'Email required',
            uniqueness: 'Email already taken'
          }
        }
      },
      ru: {
        validation: {
          name : {
          },
          email: {
            presence  : 'Электропочта надо',
            uniqueness: 'Электропочта уже взят'
          }
        }
      }
    };

    User.validatesUniquenessOf('email');
    User.validatesPresenceOf('name', 'email');
  });

  it('should hook up localized string', function (done){
    User
      .create({email: 'John.Doe@example.com', name: 'John Doe'})
      .then(function (){
        return User.create({email: 'John.Doe@example.com'});
      }).catch(function (user){
        var errors = user.errors.__localize('ru');
        expect(errors.name[0]).to.equal('can\'t be blank');
        expect(errors.email[0]).to.equal('Электропочта уже взят');
      }).done(done);
  });
});
