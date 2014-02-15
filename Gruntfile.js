module.exports = function(grunt) {
  grunt.initConfig({
    'mocha_istanbul': {
      coverage: {
        src: 'test',
        options: {
          quiet: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-mocha-istanbul');

  grunt.registerTask('coverage', ['mocha_istanbul:coverage']);
};