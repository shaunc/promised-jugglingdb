var db, Page;

describe('list', function (){

  before(function (){
    db = getSchema();
    Page = db.define('Page', function (m){
      m.property('widgets', []);
    });
  });

  it('should be exported to json just as "items"', function (){
    var p = new Page({widgets: ['hello']});
    expect(JSON.stringify(p)).to.equal(
      '{"widgets":[{"id":"hello"}]}'
    );
  });

  it('should push and remove object', function (){
    var p = new Page({widgets: []});
    p.widgets.push(7);
    expect(JSON.stringify(p.widgets)).to.equal('[{"id":7}]');
    p.widgets.remove(7);
    expect(JSON.stringify(p.widgets)).to.equal('[]');
  });

  describe('#map', function (){

    it('should collect field', function (){
      var p = new Page({widgets: [
        {foo: 'bar'},
        {foo: 'baz'}
      ]});
      expect(p.widgets.map('foo')).to.eql(['bar', 'baz']);
    });

    it('should work as usual js array map', function (){
      var p = new Page({widgets: [
        {foo: 'bar'},
        {foo: 'baz'}
      ]});
      expect(p.widgets.map(function (x){
        return x.id;
      })).to.eql([1, 2]);
    });

  });

  describe('#find', function (){

    it('should find object', function (){
      var p = new Page({widgets: ['foo', 'bar', 'baz']});
      expect(JSON.stringify(
        p.widgets.find('foo')
      )).to.eql('{"id":"foo"}');
    });

    it('should find object by property', function (){
      var p = new Page({widgets: [
        {foo: 'bar'},
        {foo: 'baz'}
      ]});
      expect(JSON.stringify(
        p.widgets.find('bar', 'foo')
      )).to.eql('{"foo":"bar","id":1}');
    });

  });
});
