var liveReload = require('connect-livereload');
var mountFolder = function (connect, dir) {
	return connect.static(require('path').resolve(dir));
};

module.exports = function(grunt) {
	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		watch: {
			less: {
				files: ['src/styles/*.less'],
				tasks: ['less:server']
			},
			server: {
				files: [
					'.tmp/styles/*.css',
					'src/scripts/*.js',
					'src/images/*.{jpg,png,gif,svg}',
					'src/*.html',
					'src/*.json'
				],
				options: {
					livereload: true
				}
			}
		},
		connect: {
			options: {
				port: 9000,
				hostname: '0.0.0.0'
			},
			server: {
				options: {
					middleware: function (connect) {
						return [
							liveReload(),
							mountFolder(connect, '.tmp'),
							mountFolder(connect, 'src')
						];
					}
				}
			}
		},
		clean: {
			dist: 'dist',
			server: '.tmp'
		},
		less: {
			options: {
				paths: ['src/styles', 'src/bower_components']
			},
			dist: {
				files: {
					'dist/styles/styles.css': 'src/styles/styles.less'
				}
			},
			server: {
				files: {
					'.tmp/styles/styles.css': 'src/styles/styles.less',
				}
			}
		},
		useminPrepare: {
			html: ['src/*.html'],
			options: {
				dest: 'dist'
			}
		},
		usemin: {
			html: ['dist/*.html'],
			options: {
				dirs: ['dist']
			}
		},
		copy: {
			assets: {
				files: [{
					expand: true,
					cwd: 'src',
					dest: 'dist',
					src: [
						'*.{html,txt,htaccess,json,hbs}',
						'**/*.{png,jpg,gif,svg,ico}',
						'**/*.{eot,ttf,woff}',
						'**/*.mp3'
					]
				}]
			}
		}
	});


	grunt.registerTask('server', [
		'clean:server',
		'less:server',
		'connect',
		'watch'
	]);

	grunt.registerTask('build', [
		'clean:dist',
		'less:dist',
		'useminPrepare',
		'concat',
		'copy',
		'usemin'
	]);

	grunt.registerTask('default', 'build');
}
