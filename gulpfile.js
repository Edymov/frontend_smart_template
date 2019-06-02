'use strict'

const autoprefixer = require('autoprefixer')
const bourbon = require('node-bourbon').includePaths
const browserSync = require('browser-sync').create()
const cachebust = require('gulp-cache-bust')
const cmq = require('css-mqpacker')
const cssnano = require('cssnano')
const del = require('del')
const ghpages = require('gulp-gh-pages')
const gulp = require('gulp')
const imagemin = require('gulp-imagemin')
const imageminJpegRecompress = require('imagemin-jpeg-recompress')
const imageminMozjpeg = require('imagemin-mozjpeg')
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
const notifier = require('node-notifier')
const path = require('path')
const plumber = require('gulp-plumber')
const pngquant = require('imagemin-pngquant')
const postcss = require('gulp-postcss')
const processhtml = require('gulp-processhtml')
const rename = require('gulp-rename')
const sass = require('gulp-dart-sass')
const sassGlob = require('gulp-sass-glob')
const spritesmith = require('gulp.spritesmith')
const svgmin = require('gulp-svgmin')
const svgSprite = require('gulp-svg-sprites')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

//
// STYLES TASKS
//

gulp.task('sass', () => {
  const processors = [
    autoprefixer()
  ]
  return gulp.src('./src/scss/**/*.scss')
    .pipe(plumber())
    .pipe(sassGlob())
    .pipe(sass({
      outputStyle: 'expanded',
      includePaths: bourbon
    }).on('error', sass.logError))
    .pipe(postcss(processors))
    .pipe(gulp.dest('dev/css/'))
    .pipe(browserSync.stream())
})

gulp.task('cssBuild', () => {
  const processors = [cssnano({ discardComments: { removeAll: true } }), cmq()]

  return gulp.src('dev/css/**/*.css')
    .pipe(plumber())
    .pipe(postcss(processors))
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest('./build/css'))
})

//
//  JS TASKS
//

gulp.task('webpack', (callback) => {
  let options = {
    entry: './src/scripts/index',
    mode: isDev ? 'development' : 'production',
    output: {
      path: isDev ? path.join(__dirname, '/dev/js') : path.join(__dirname, '/build/js'),
      filename: isDev ? 'app.js' : 'app.min.js'
    },
    watch: isDev,
    devtool: isDev ? 'cheap-module-source-map' : false,
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            output: {
              comments: false
            }
          }
        })
      ]
    },

    module: {
      rules: [
        {
          test: /.js?$/,
          loader: 'babel-loader',
          exclude: /node_modules|bower_components/
        }
      ]
    },
    watchOptions: {
      aggregateTimeout: 10
    },
    resolve: {
      modules: ['node_modules', 'bower_components']
    }
  }

  webpack(options, (err, stats) => {
    if (!err) {
      err = stats.toJson().errors[0]
    }

    if (err) {
      notifier.notify({
        title: 'Webpack',
        message: err
      })

      console.error(err)
    } else {
      console.info(stats.toString({
        colors: true
      }))
    }

    if (!options.watch && err) {
      callback(err)
    } else {
      callback()
    }
  })
})

//
//    GRAPHICS TASK
//

gulp.task('images', () => {
  if (isDev) {
    return gulp.src(['./src/img/*.*', '!./src/img/sprite/'])
      .pipe(gulp.dest('./dev/img'))
  }
  return gulp.src(['./src/img/*.{jpg,jpeg,png,gif}', '!./src/img/sprite/'])
    .pipe(
      imagemin(
        [
          imageminMozjpeg({ quality: 60 }),
          pngquant({ quality: [0.6, 0.7] }),
          imageminJpegRecompress({ target: '0.7' }),
          imagemin.gifsicle()
        ]
      )
    )
    .pipe(gulp.dest('./build/img'))
})

gulp.task('svg', () => {
  return gulp.src('./src/img/*.svg')
    .pipe(svgmin(
      {
        plugins: [
          {
            cleanupIDs: {
              remove: false
            }
          },
          { removeTitle: {} }
        ]
      })
    )
    .pipe(gulp.dest('./build/img'))
})

/*
  SPRITES
 */
gulp.task('sprite', () => {
  const spriteData =
  gulp.src('./src/img/sprite/*.png')
    .pipe(spritesmith({
      imgName: 'sprite.png',
      cssName: '_sprite.scss',
      cssFormat: 'scss',
      algorithm: 'binary-tree',
      cssTemplate: 'scss.template.mustache'
    }))
  spriteData.img.pipe(gulp.dest('./dev/img/'))
  spriteData.css.pipe(gulp.dest('./src/scss/utils'))
})
gulp.task('retina_sprite', () => {
  const spriteData =
        gulp.src('./src/img/sprite/*.png')
          .pipe(spritesmith({
            imgName: 'sprite.png',
            cssName: '_sprite.scss',
            cssFormat: 'scss',
            algorithm: 'binary-tree',
            cssTemplate: 'scss.template.mustache',
            retinaSrcFilter: './dev/img/sprite/*2x.png',
            retinaImgName: 'spritesheet-2x.png'
          }))
  spriteData.img.pipe(gulp.dest('./src/img/'))
  spriteData.css.pipe(gulp.dest('./src/scss/utils'))
})

/*
 SVG SPRITE
 */
gulp.task('svgSprite', () => {
  return gulp.src('./src/img/sprite/*.svg')
    .pipe(svgSprite({
      cssFile: '../../src/scss/base/_svg-sprite.scss',
      mode: 'symbols',
      preview: false,
      selector: 'icon-%f',
      svg: {
        symbols: 'sprite.svg'
      },
      templates: { scss: true }
    }
    ))
    .pipe(gulp.dest('./dev/img/'))
})

//
// HTML TASK
//

gulp.task('html', () => {
  return gulp.src('./src/*.html')
    .pipe(processhtml())
    .pipe(cachebust({
      type: 'timestamp'
    }))
    .pipe(gulp.dest(isDev ? './dev' : './build'))
})

//
// DEPLOY TASKS
//
gulp.task('ghdeploy', () => {
  return gulp.src('build/**/*')
    .pipe(ghpages())
})

//
// MISC TASKS
//

gulp.task('clean', () => {
  if (isDev) {
    return del(['dev', 'dev/**'])
  }
  return del(['build', 'build/**'])
})

gulp.task('fonts', () => {
  return gulp.src('./src/fonts/**/*')
    .pipe(gulp.dest(`./${isDev ? 'dev' : 'build'}/fonts`))
})

gulp.task('copy', gulp.parallel(() => {
  if (isDev) {
    return gulp.src(['./src/*', '!src/img', '!src/scss', '!src/scripts'])
      .pipe(gulp.dest('./dev'))
  }
  return gulp.src(['./src/*', '!src/img/', '!src/scss', '!src/scripts'])
    .pipe(gulp.dest('./build'))
}))

//
// BUILDING TASKS
//

// SERVE & WATCH TASKS

gulp.task('serve', () => {
  browserSync.init({
    server: './dev'
  })

  gulp.watch(['./src/**/*.*', '!./src/img'], gulp.series('copy'))
  gulp.watch(['./src/img/**/*', '!./src/img/sprite/'], gulp.series('images'))
  gulp.watch('./src/scss/**/*.scss', gulp.series('sass'))
  gulp.watch(['./src/**/*.*', '!./src/img']).on('change', browserSync.reload)
})

gulp.task('process', gulp.series('clean', 'fonts', 'copy',
  'images', gulp.parallel('sass', 'webpack'), 'serve'), () => {})

gulp.task('default', gulp.task('process'))

gulp.task('build',
  gulp.series('clean', 'fonts', 'copy', gulp.parallel('cssBuild', 'webpack', 'html', 'images', 'svg'))
)
