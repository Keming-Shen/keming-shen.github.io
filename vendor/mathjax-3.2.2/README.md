The core renderer, its WOFF-v2 fonts and the boldsymbol extension are exact
copies of MathJax 3.2.2. `manifest.json` records their archive source, sizes and
SHA-256 checksums. `preload.json` lists the local fonts and extension for page
preparation before navigation.

The Butterfly MathJax bootstrap keeps the optional-module loader pointed at
`https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5`. Advanced menu actions such as
switching renderers or enabling speech can therefore request their original
pinned modules on demand. The bundled menu and assistive MathML, regular CHTML
formulas, local fonts and published boldsymbol formulas need no CDN request.
The bootstrap explicitly maps boldsymbol and the CHTML font directory locally.

Runtime assets are unmodified. The package's Apache 2.0 license is included.
