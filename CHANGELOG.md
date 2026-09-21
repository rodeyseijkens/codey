# Changelog

## [0.3.0](https://github.com/rodeyseijkens/codey/compare/v0.2.0...v0.3.0) (2026-09-21)


### Features

* add diff row window module ([26f8c2b](https://github.com/rodeyseijkens/codey/commit/26f8c2bda38d939e334a09bb95c1a27d68401abc))
* add sidebar control and layout mode icon glyphs ([e6664a7](https://github.com/rodeyseijkens/codey/commit/e6664a799f9eef847a9b91a4c16a41c88df483f2))
* add toggle-folders command with no default keybinding ([add33b1](https://github.com/rodeyseijkens/codey/commit/add33b1c5faded5d1be0d4a4fa40e6d05681b68b))
* add VHS screenshot pipeline for the README ([6bdf97a](https://github.com/rodeyseijkens/codey/commit/6bdf97ad180406eefd6c2aef22db15c00fbf24f7))
* collapse or expand all tree folders via toggleAllTreeFolders ([2ee6b4c](https://github.com/rodeyseijkens/codey/commit/2ee6b4c4b82bced167fc5b6d24900e4d8b48ef65))
* mount only the visible diff row window ([dd53164](https://github.com/rodeyseijkens/codey/commit/dd531642e88943a7d055644a1938f6d44a6f3707))
* move diff pane title onto the border with a clickable layout mode icon ([f4aef28](https://github.com/rodeyseijkens/codey/commit/f4aef28c3b9fec67fac7d8e587c4d3ce5d21f5a4))
* move notifications to the top right of the top bar ([37582ad](https://github.com/rodeyseijkens/codey/commit/37582add46c0442d3081cea201cfae7cfc2829b7))
* move refreshing state to the top bar ([6883f6f](https://github.com/rodeyseijkens/codey/commit/6883f6fac9e1bf31f7ac2716158db6b0f6f1ebee))
* replace sidebar border title with clickable view, collapse, and refresh icons ([8daf837](https://github.com/rodeyseijkens/codey/commit/8daf8372d78d3db812ad1a580f4eadbb3e722e6e))
* simplify top bar to branch, loader mode, and watch ([41a4375](https://github.com/rodeyseijkens/codey/commit/41a4375036af4b94b273faeaa593b94f7d221d44))


### Bug Fixes

* account for note guide column in measured row heights ([a7940c6](https://github.com/rodeyseijkens/codey/commit/a7940c6ec649ee916bd99a523815580b923eb424))
* measure comment cards at their rendered height ([df6e342](https://github.com/rodeyseijkens/codey/commit/df6e342aabc6938b7f3923638e7a6aebb74c3e13))
* move diff search overlay to the left side of the chrome row ([c2f2970](https://github.com/rodeyseijkens/codey/commit/c2f29701e9a4c6c005526becc3f302825bfe96b9))
* only count visible folders when toggling all tree folders ([7d818ec](https://github.com/rodeyseijkens/codey/commit/7d818ec4054b4bf9360f35e27d10a8041d66eccf))
* open codey pane in new workspace checkout ([ddc26b5](https://github.com/rodeyseijkens/codey/commit/ddc26b5d8b0eefa8e3ae0b6a15a103821f782c2a))
* set width to 100% for DiffPaneChrome ([fde0e5c](https://github.com/rodeyseijkens/codey/commit/fde0e5c73498ffc18d2b07c71641265e5013ebfc))


### Performance Improvements

* emit canonical-layout index maps from diff row builders ([8981b91](https://github.com/rodeyseijkens/codey/commit/8981b91836fddc230390d4c9bd4d5e7dde29cac0))
* match search against registered diff rows ([843255a](https://github.com/rodeyseijkens/codey/commit/843255aebdd125767372159df82bc3a38978dd4e))
* reuse cached canonical rows and memoize patch parsing ([b3f93de](https://github.com/rodeyseijkens/codey/commit/b3f93deeb45533fbde4c47be7c2f9aef4776c70b))

## [0.2.0](https://github.com/rodeyseijkens/codey/compare/v0.1.4...v0.2.0) (2026-09-16)


### Features

* add -v shorthand for --version ([9bf8657](https://github.com/rodeyseijkens/codey/commit/9bf86571322ded5bf2284830f2b95f5476fb06d6))
* open focused file in editor with E ([1247bce](https://github.com/rodeyseijkens/codey/commit/1247bcec45bc1a0f180e3b78d436521516968f84))
* support pierre themes and any shiki theme id ([2848035](https://github.com/rodeyseijkens/codey/commit/284803595f39cef0421815977d9c226d7c51ac02))


### Bug Fixes

* fetch herdr plugin binary on install ([d6045da](https://github.com/rodeyseijkens/codey/commit/d6045da39d76acb5ecb2a7cf53c64e8cdfcbc6e7))
* harden herdr plugin install path ([152269a](https://github.com/rodeyseijkens/codey/commit/152269a8a801c2b70e23bf78bc6cd883ab373e1b))
* normalize resolved theme colors to opaque sRGB hex ([d2454b7](https://github.com/rodeyseijkens/codey/commit/d2454b747203f81ff00f5239b6eb059cb19844e9))
* render display-p3 token colors as srgb ([a4a007d](https://github.com/rodeyseijkens/codey/commit/a4a007dfbb1ed87d0d96a902be3223c9fead47d2))
* scroll help overlay with j/k and arrow keys ([3e6e38b](https://github.com/rodeyseijkens/codey/commit/3e6e38bd2b4572d701ded3326e0f2fc4342d33eb))

## [0.1.4](https://github.com/rodeyseijkens/codey/compare/v0.1.3...v0.1.4) (2026-09-12)


### Bug Fixes

* clear reword draft on ctrl+c ([958a05b](https://github.com/rodeyseijkens/codey/commit/958a05b9443c9aa38f8a85d46d021b29b361e127))
* prefill reword input with original commit message ([cfc86d5](https://github.com/rodeyseijkens/codey/commit/cfc86d56d64d8952f75dc1823118ae2fb79ceab8))
* replace em dash escapes in commit placeholder text ([042d440](https://github.com/rodeyseijkens/codey/commit/042d4403bd526a4b832c228b39e80fb663bbc7fa))

## [0.1.3](https://github.com/rodeyseijkens/codey/compare/v0.1.2...v0.1.3) (2026-09-07)


### Bug Fixes

* fail fast when npm CLI is too old for trusted publishing ([#9](https://github.com/rodeyseijkens/codey/issues/9)) ([bc13f57](https://github.com/rodeyseijkens/codey/commit/bc13f577eabd1aa5b259d9c5b88213274d96c12a))

## [0.1.2](https://github.com/rodeyseijkens/codey/compare/v0.1.1...v0.1.2) (2026-09-05)


### Bug Fixes

* release-please inline markers and chained publish workflow ([#6](https://github.com/rodeyseijkens/codey/issues/6)) ([fe252ef](https://github.com/rodeyseijkens/codey/commit/fe252ef8f429aacbaf9530c9842506250563b011))

## [0.1.1](https://github.com/rodeyseijkens/codey/compare/v0.1.0...v0.1.1) (2026-09-05)


### Bug Fixes

* skip already-published packages and set gh token for asset upload ([e77bf4c](https://github.com/rodeyseijkens/codey/commit/e77bf4ceb17a075b054c2375c82d8be5d73994ac))
