var gulp = require('gulp')
var babel = require('gulp-babel')
var uglify = require('gulp-uglify')
var rename = require('gulp-rename')
var standard = require('gulp-standard')

var script = 'src/search-light.js'
var dest = 'dist/'

gulp.task('standard', function () {
  return gulp.src(script)
    .pipe(standard())
    .pipe(standard.reporter('default', {
      breakOnError: true,
      quiet: true
    }))
})

gulp.task('js', function () {
  return gulp.src(script)
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest(dest))
    .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest(dest))
})

gulp.task('default', [ 'standard', 'js' ])
