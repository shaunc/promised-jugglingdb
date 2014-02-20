module.exports = function(grunt) {
  grunt.initConfig({
    'mocha_istanbul': {
      coverage: {
        src: 'test'
      },
      coveralls: {
        src: 'test',
        options: {
          quiet: true,
          coverage: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-mocha-istanbul');

  grunt.event.on('coverage', function(lcov, done){
    require('coveralls').handleInput(lcov, function(){
      done();
    });
  });

  grunt.registerTask('coverage', ['mocha_istanbul:coverage']);
  grunt.registerTask('coveralls', ['mocha_istanbul:coveralls']);
};