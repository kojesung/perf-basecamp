const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  const isAnalyze = Boolean(env && env.analyze);

  return {
    mode: isProd ? 'production' : 'development',
    entry: './src/index.tsx',
    resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
    output: {
      filename: '[name].[contenthash:8].js',
      chunkFilename: '[name].[contenthash:8].chunk.js',
      path: path.join(__dirname, '/dist'),
      clean: true,
      assetModuleFilename: 'static/[name].[contenthash:8][ext]'
    },
    devServer: {
      hot: true,
      open: true,
      historyApiFallback: true
    },
    devtool: 'source-map',
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html'
      }),
      // LCP 이미지인 hero를 JS 실행 전에 받도록 해시 파일명으로 preload 태그 삽입
      {
        apply(compiler) {
          compiler.hooks.compilation.tap('PreloadHeroPlugin', (compilation) => {
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap(
              'PreloadHeroPlugin',
              (data) => {
                const heroAsset = Object.keys(compilation.assets).find((name) =>
                  /^static\/hero\..+\.webp$/.test(name)
                );
                if (heroAsset) {
                  data.headTags.unshift(
                    HtmlWebpackPlugin.createHtmlTagObject('link', {
                      rel: 'preload',
                      as: 'image',
                      href: heroAsset,
                      type: 'image/webp',
                      fetchpriority: 'high'
                    })
                  );
                }
                return data;
              }
            );
          });
        }
      },
      new CopyWebpackPlugin({
        patterns: [{ from: './public', to: './public' }]
      }),
      new Dotenv(),
      // npm run analyze 로 실행할 때만 번들 구성 리포트를 생성 (dist 밖에 저장해 배포물에 섞이지 않도록 함)
      ...(isAnalyze
        ? [
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              reportFilename: path.join(__dirname, 'bundle-report.html'),
              openAnalyzer: true
            })
          ]
        : []),
      ...(isProd
        ? [new MiniCssExtractPlugin({ chunkFilename: '[name].[contenthash:8].chunk.css' })]
        : []),
      new ImageMinimizerPlugin({
        minimizer: {
          implementation: ImageMinimizerPlugin.sharpMinify,
          options: { encodeOptions: { jpeg: { quality: 80 }, webp: { quality: 80 } } }
        },
        generator: [
          {
            preset: 'webp', // ?as=webp -> 사진형, 애니메이션형 이미지에 사용
            implementation: ImageMinimizerPlugin.sharpGenerate,
            // effort: 탐색 강도(0~6). 빌드 시간을 더 쓰는 대신 같은 화질을 더 작게 압축한다.
            // encodeOptions의 preset: 인코더를 사진 특성에 맞게 튜닝 (위의 preset과는 다른 옵션)
            options: { encodeOptions: { webp: { quality: 75, effort: 6, preset: 'photo' } } }
          },
          {
            preset: 'webp-lossless', // ?as=webp-lossless -> 그래픽형 이미지에 사용
            implementation: ImageMinimizerPlugin.sharpGenerate,
            options: { encodeOptions: { webp: { lossless: true } } }
          }
        ]
      })
    ],
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/i,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            // tsconfig의 removeComments가 webpackChunkName 매직 코멘트를 지우지 않도록 비활성화
            options: { compilerOptions: { removeComments: false } }
          }
        },
        {
          test: /\.css$/i,
          use: [isProd ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader']
        },
        {
          test: /\.(eot|svg|ttf|woff|woff2|png|jpe?g|gif|webp|avif|mp4)$/i,
          type: 'asset/resource'
        }
      ]
    },
    optimization: {
      minimizer: ['...', new CssMinimizerPlugin()]
    }
  };
};
