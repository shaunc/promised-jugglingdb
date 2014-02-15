// This test written in mocha+should.js
var db, Book, Chapter, Author, Reader;

describe('relations', function (){
  before(function (done){
    db = getSchema();
    Book = db.define('Book', {name: String});
    Chapter = db.define('Chapter', {name: {type: String, index: true, limit: 20}});
    Author = db.define('Author', {name: String});
    Reader = db.define('Reader', {name: String});

    db.automigrate(function (){
      Book.destroyAll(function (){
        Chapter.destroyAll(function (){
          Author.destroyAll(function (){
            Reader.destroyAll(done);
          });
        });
      });
    });
  });

  after(function (){
    db.disconnect();
  });

  describe('hasMany', function (){
    it('can be declared in different ways', function (done){
      Book.hasMany(Chapter);
      Book.hasMany(Reader, {as: 'users'});
      Book.hasMany(Author, {foreignKey: 'projectId'});
      var b = new Book;
      expect(b.chapters).to.be.a('function');
      expect(b.users).to.be.a('function');
      expect(b.authors).to.be.a('function');
      expect(Object.keys((new Chapter()).toObject())).to.contain('bookId');
      expect(Object.keys((new Author()).toObject())).to.contain('projectId');

      db.automigrate(done);
    });

    it('can be declared in short form', function (done){
      Author.hasMany('readers');
      expect((new Author()).readers).to.be.a('function');
      expect(Object.keys((new Reader()).toObject())).to.contain('authorId');

      db.autoupdate(done);
    });

    it('should build record on scope', function (done){
      Book.create(function (err, book){
        var c = book.chapters.build();
        expect(c.bookId).to.equal(book.id);
        c.save(done);
      });
    });

    it('should create record on scope', function (done){
      Book.create(function (err, book){
        book.chapters.create(function (err, c){
          expect(err).to.not.be.ok();
          expect(c).to.be.ok();
          expect(c.bookId).to.equal(book.id);
          done();
        });
      });
    });

    it.skip('should fetch all scoped instances', function (done){
      Book.create(function (err, book){
        book.chapters.create({name: 'a'}, function (){
          book.chapters.create({name: 'z'}, function (){
            book.chapters.create({name: 'c'}, function (){
              fetch(book);
            });
          });
        });
      });
      function fetch(book){
        book.chapters(function (err, ch){
          expect(err).to.not.be.ok();
          expect(ch).to.be.ok();
          expect(ch).to.have.length(3);

          book.chapters({order: 'name DESC'}, function (e, c){
            expect(e).to.not.be.ok();
            expect(ch).to.be.ok();
            expect(c.shift().name).to.equal('z');
            expect(c.pop().name).to.equal('a');
            done();
          });
        });
      }
    });

    it('should find scoped record', function (done){
      var id;
      Book.create(function (err, book){
        book.chapters.create({name: 'a'}, function (err, ch){
          id = ch.id;
          book.chapters.create({name: 'z'}, function (){
            book.chapters.create({name: 'c'}, function (){
              fetch(book);
            });
          });
        });
      });

      function fetch(book){
        book.chapters.find(id, function (err, ch){
          expect(err).to.not.be.ok();
          expect(ch).to.be.ok();
          expect(ch.id).to.equal(id);
          done();
        });
      }
    });

    it('should destroy scoped record', function (done){
      Book.create(function (err, book){
        book.chapters.create({name: 'a'}, function (err, ch){
          book.chapters.destroy(ch.id, function (err){
            expect(err).to.not.be.ok();
            book.chapters.find(ch.id, function (err, ch){
              expect(err).to.be.ok();
              expect(err.message).to.equal('Not found');
              expect(ch).to.not.be.ok();
              done();
            });
          });
        });
      });
    });

    it('should not allow destroy not scoped records', function (done){
      Book.create(function (err, book1){
        book1.chapters.create({name: 'a'}, function (err, ch){
          var id = ch.id;
          Book.create(function (err, book2){
            book2.chapters.destroy(ch.id, function (err){
              expect(err).to.be.ok();
              expect(err.message).to.equal('Permission denied');
              book1.chapters.find(ch.id, function (err, ch){
                expect(err).to.not.be.ok();
                expect(ch).to.be.ok();
                expect(ch.id).to.equal(id);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('belongsTo', function (){
    var List, Item, Fear, Mind;

    it('can be declared in different ways', function (){
      List = db.define('List', {name: String});
      Item = db.define('Item', {name: String});
      Fear = db.define('Fear');
      Mind = db.define('Mind');

      // syntax 1 (old)
      Item.belongsTo(List);
      expect(Object.keys((new Item()).toObject())).to.contain('listId');
      expect((new Item()).list).to.be.a('function');

      // syntax 2 (new)
      Fear.belongsTo('mind');
      expect(Object.keys((new Fear()).toObject())).to.contain('mindId');
      expect((new Fear()).mind).to.be.a('function');
      // (new Fear).mind.build().should.be.an.instanceOf(Mind);
    });

    it('can be used to query data', function (done){
      List.hasMany('todos', {model: Item});
      db.automigrate(function (){
        List.create(function (e, list){
          expect(e).to.not.be.ok();
          expect(list).to.be.ok();
          list.todos.create(function (err, todo){
            todo.list(function (e, l){
              expect(e).to.not.be.ok();
              expect(l).to.be.ok();
              expect(l).to.be.a(List);
              expect(todo.list()).to.equal(l.id);
              done();
            });
          });
        });
      });
    });

    it('could accept objects when creating on scope', function (done){
      List.create(function (e, list){
        expect(e).to.not.be.ok();
        expect(list).to.be.ok();
        Item.create({list: list}, function (err, item){
          expect(err).to.not.be.ok();
          expect(item).to.be.ok();
          expect(item.listId).to.be.ok();
          expect(item.listId).to.equal(list.id);
          expect(item.__cachedRelations.list).to.equal(list);
          done();
        });
      });
    });

  });

  describe('hasAndBelongsToMany', function (){
    var Article, Tag, ArticleTag;
    it('can be declared', function (done){
      Article = db.define('Article', {title: String});
      Tag = db.define('Tag', {name: String});
      Article.hasAndBelongsToMany('tags');
      ArticleTag = db.models.ArticleTag;
      db.automigrate(function (){
        Article.destroyAll(function (){
          Tag.destroyAll(function (){
            ArticleTag.destroyAll(done);
          });
        });
      });
    });

    it('should allow to create instances on scope', function (done){
      Article.create(function (e, article){
        article.tags.create({name: 'popular'}, function (e, t){
          expect(t).to.be.a(Tag);
          ArticleTag.findOne(function (e, at){
            expect(at).to.be.ok();
            expect(at.tagId.toString()).to.equal(t.id.toString());
            expect(at.articleId.toString()).to.equal(article.id.toString());
            done();
          });
        });
      });
    });

    it('should allow to fetch scoped instances', function (done){
      Article.findOne(function (e, article){
        article.tags(function (e, tags){
          expect(e).to.not.be.ok();
          expect(tags).to.be.ok();
          done();
        });
      });
    });

    it('should allow to add connection with instance', function (done){
      Article.findOne(function (e, article){
        Tag.create({name: 'awesome'}, function (e, tag){
          article.tags.add(tag, function (e, at){
            expect(e).to.not.be.ok();
            expect(at).to.be.ok();
            expect(at).to.be.a(ArticleTag);
            expect(at.tagId).to.equal(tag.id);
            expect(at.articleId).to.equal(article.id);
            done();
          });
        });
      });
    });

    it('should allow to remove connection with instance', function (done){
      Article.findOne(function (e, article){
        article.tags(function (e, tags){
          var len = tags.length;
          expect(tags).to.not.be.empty();
          expect(tags[0]).to.be.ok();
          article.tags.remove(tags[0], function (e){
            expect(e).to.not.be.ok();
            article.tags(true, function (e, tags){
              expect(tags).to.have.length(len - 1);
              done();
            });
          });
        });
      });
    });

    it('should remove the correct connection', function (done){
      Article.create({title: 'Article 1'}, function (e, article1){
        Article.create({title: 'Article 2'}, function (e, article2){
          Tag.create({name: 'correct'}, function (e, tag){
            article1.tags.add(tag, function (e, at){
              article2.tags.add(tag, function (e, at){
                article2.tags.remove(tag, function (e){
                  article2.tags(true, function (e, tags){
                    expect(tags).to.have.length(0);
                    article1.tags(true, function (e, tags){
                      expect(tags).to.have.length(1);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

  });

});
