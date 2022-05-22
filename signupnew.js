let SHOW_DEBUG = false;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';

(async function() {
    let $ = (id) => {return document.getElementById(id)};

    $('divDebug').setAttribute('style', SHOW_DEBUG?'':'display:none');
    $('fileInput').addEventListener('change', onFileChange);
    console.log('File Change event added');

    function logx(message) {
        $("divDebug").innerHTML = message;
    }

    function logx2(message) {
        if($ && $('divDebug')) {
            let htmlOld = $("divDebug").innerHTML;
            document.getElementById("divDebug").innerHTML =
                (htmlOld && htmlOld.length > 0)? (htmlOld + " </br>" + message): message;
        }
    }

    function logx2NS(message) {
        oWebViewInterface.emit('onConsoleMessage', message);
    }

    function logAll(message){
        /// NOTE: This logs in local window `divDebug`
        /// and sends a Console output message to the Mobile client
        logx2(message);
        logx2NS(message)
    }

    // Final target Canvas
    let _canvasDisplay = new fabric.Canvas('canvasDisplay',{centeredScaling: true});
    // PDF Rendering canvas
    let _canvasRender = new fabric.Canvas('canvasRender', {centeredScaling: true});

    const oWebViewInterface = window.nsWebViewInterface
    const hiddenFull = document.getElementById('hiddenFull');
    const _clientWidth = hiddenFull.clientWidth - 20;
    const _clientHeight = hiddenFull.clientHeight;
    const _devicePixelRatio = window.devicePixelRatio;

    _canvasDisplay.setWidth(_clientWidth);
    _canvasDisplay.setHeight(_clientHeight);
    _canvasRender.setWidth(_clientWidth);
    _canvasRender.setHeight(_clientHeight);

    // logx2('Parent width:' + _clientWidth + ' Parent Height: ' + _clientHeight);
    // console.log('Parent width:' + _clientWidth + ' Parent Height: ' + _clientHeight + ' device pixel ratio:' + _devicePixelRatio);

    // Js PDF Canvas, stays hidden as we load each page and show it on the Canvas

    let _desiredWidth = window.innerWidth - 15;
    let _desiredHeight = window.innerHeight - 15;
    let _signaturePad;
    let _currentSignature;
    let _currentPDFB64;
    let _totalPages = 0;
    let _currentPage = 1;
    let _canvasStates = [];
    let _pageSVGs = [];

    let _deviceType = '';
    let _heightDIP = 0;
    let _widthDIP = 0;
    let _isPhone = false;

    let currentPDFFile = 'sample.pdf';

    let toolbox = $('toolbox'),
        subToolbox = $('subToolbox'),
        workbench = $('toolWorkbench'),
        btnSignature = $('btnSignature'),
        btnName = $('btnName'),
        btnAddress = $('btnAddress'),
        btnDate = $('btnDate'),
        btnDone = $('btnDone'),
        btnApply = $('btnApply'),
        signatureCapture = $('signatureCapture'),
        btnShowSignature = $("btnShowSignature"),
        btnHideSignature = $("btnHideSignature"),
        btnUndo = $("btnUndo"),
        btnReset = $("btnReset"),
        btnAccept = $('btnAccept'),
        pageNumberSection = $("pageNumberSection"),
        pageNumberDiv = $("pageNumber");

    // let elem = document.createElement('div');
    // elem.id = 'div2'
    // elem.innerHtml = "Something";
    // document.getElementById('divContainer').appendChild(elem);

    window.callJSFromDevice = (arg) => {
        logx2('Called JS from Device');
    }

    window.setPDF = async (pdfContent, height, width, deviceType) => {
        _deviceType = deviceType;
        _heightDIP = height;
        _widthDIP = width;
        _isPhone = (_deviceType === 'Phone');

        _currentPDFB64  = pdfContent; // Current PDF is stored and processed
        await window.processPDFFileAllPages(_currentPDFB64);
        // await processPDFFile(_currentPDFB64, 1);
        setPageSVG(_currentPage);
        onShowSignUpTools();
        //hideElement(btnAccept);
        // onSign();
    }

    window.processPDFFileAllPages = async (pdfDataURL) => {
        let pdfbin = convertDataURIToBinary(pdfDataURL);
        let loadingTask = pdfjsLib.getDocument(pdfbin);

        await loadingTask.promise
            .then(async (pdf) => {
                _totalPages = pdf.numPages;

                if(_totalPages > 0) {
                    // _canvasStates = [_totalPages];
                    // NOTE: pdfJs page number is starts at 1
                    // We are loading in reverse order, so we stop on the 1st page
                    for(let pageNum = _totalPages; pageNum > 0; pageNum--) {
                        //logx(`Processing page: ${pdfPageNumber}`);
                        // await processPage(pdf, pageNum);
                        await processPage2(pdf, pageNum);
                    }
                }
            })
            .catch((err) => {
                logx('Error @ processPDFFileAllPages' + JSON.stringify(err));
            });

        if(_totalPages> 0) {
            updatePageNumber();
        }
    }

    window.processPDFFile = async (pdfDataURL, pageNumber) => {
        let pdfbin = convertDataURIToBinary(pdfDataURL);
        let loadingTask = pdfjsLib.getDocument(pdfbin);

        await loadingTask.promise
            .then(async (pdf) => {
                let totalPages = pdf.numPages;
                if(totalPages > 0) {
                    await processPage2(pdf, pageNumber);
                }
            });
    }

    async function processPage2(pdf, pageNumber) {
        // We use 2 canvases. One is used by pdfjs to render the PDF. Then we get the PDF as an png and apply it as a
        // background to the second canvas
        if(pdf) {
            await pdf.getPage(pageNumber).then(async (page) => {
                let displayCanvas = _canvasDisplay;
                let renderCanvas = _canvasRender;
                let renderViewport = page.getViewport({ scale: .6});
                //renderCanvas.scale(1, 1);

                await page.render({'canvasContext': renderCanvas.getContext('2d'), 'viewport': renderViewport})
                    .promise
                    .then(() => {
                        let pdfImage = renderCanvas.getElement().toDataURL('image/jpeg', 1.0);

                        // "https://data2.unhcr.org/images/documents/big_aa2c81585e808b644ef70587136c23601d33a2e9.jpg"
                        // "https://jetsetjansen.com/wp-content/uploads/2021/06/buck-island-st-croix-usvi.jpg"
                        //let picUrl = "https://images.unsplash.com/photo-1507936580189-3816b4abf640?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2370&q=80";
                        let picUrl = "https://firebasestorage.googleapis.com/v0/b/veew-dev.appspot.com/o/uploads%2F1%2Fimages%2Fimg1-1575778977325.jpg?alt=media&token=6a6b4c4a-8cb5-429c-85d6-47cb860c613b";
                        fabric.Image.fromURL(pdfImage, (img) => {
                            //logAll(`Factor X: ${displayCanvas.width / img.width} Factor Y: ${displayCanvas.height / img.height}`);

                            let scale = window.innerWidth > img.width?
                                img.width / window.innerWidth
                                : window.innerWidth/img.width;

                            // const dpi = 1 / window.devicePixelRatio;
                            // scale = scale / dpi;

                            logAll(`Canvas Width: ${displayCanvas.getWidth()}
                                Device Pixel: ${window.devicePixelRatio}
                                Window Inner: ${window.innerWidth}
                                Image Width: ${img.width}
                                Scale: ${scale}`);

                            displayCanvas.setBackgroundImage(img,
                                displayCanvas.renderAll.bind(displayCanvas), {scaleX: scale, scaleY: scale});
                        });
                    });
            });
        }
        else {
            console.log('PDF document passed for page display is null');
            logx2('PDF document passed for page display is null');
        }
    }

    window.loadPageAsBackground = () => {
        let pdfImage = _canvasRender.getElement().toDataURL("image/png");
        _canvasDisplay.setWidth(_widthDIP);
        _canvasDisplay.setHeight(_heightDIP);
        //_canvasDisplay.setBackgroundImage(pdfImage, _canvasDisplay.renderAll.bind(_canvasDisplay));
        _canvasDisplay.setBackgroundImage(pdfImage);
        _canvasDisplay.renderAll();
    }

    window.loadPageDirect = () => {
        // let pdfImage = _canvasRender.getElement().toDataURL("image/png");
        // _canvasDisplay.setWidth(_widthDIP);
        // _canvasDisplay.setHeight(_heightDIP);
        // _canvasDisplay.setBackgroundImage(pdfImage, _canvasDisplay.renderAll.bind(_canvasDisplay));

        let datalessJson = _canvasRender.toJson();
        _canvasDisplay.loadFromJSON(datalessJson);
    }

    window.convertDataURIToBinary = (dataURI) => {
        let BASE64_MARKER = ';base64,';
        let hasBase64Tag = dataURI.indexOf(BASE64_MARKER) >= 0;

        let base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
        let base64 = hasBase64Tag? dataURI.substring(base64Index): dataURI;

        let raw = window.atob(base64);
        let rawLength = raw.length;
        let array = new Uint8Array(new ArrayBuffer(rawLength));

        for(let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
        }
        return array;
    }

    window.onShowSignUpTools = () => {
        showElement(subToolbox);
        this.cvSignature = $("canvasSignature");
        // logx2('SIG SPOT: 1');
        _signaturePad = new SignaturePad(this.cvSignature);
        // logx2('SIG SPOT: 2');

        hideElement(signatureCapture);
        hideElement(btnShowSignature);
        //hideElement(btnUndo);
        //hideElement(btnReset);
        //hideElement(pageNumberSection);
        //showElement(btnHideSignature);
    }

    window.onHideSignature = () => {
        hideElement(subToolbox);
        hideElement(signatureCapture);

        hideElement(btnHideSignature);
        showElement(btnShowSignature);
        showElement(btnUndo);
        showElement(btnReset);
        showElement(pageNumberSection);
    }

    window.onDone = () => {hideElement(signatureCapture)};

    window.onApply = () => {
        applySignature();
        hideElement(signatureCapture);
        setCanvasState(_currentPage);
        showElement(hiddenFull);
        showElement(btnAccept);
    };

    window.onClear = () => {
        _currentSignature = null;
        _signaturePad.clear();
        hideElement(btnAccept);
    }

    window.closeSubTool =  () => {
        showHideElement(subToolbox);
    }

    window.acceptSubTool = () => {
        showHideElement(subToolbox);
    }

    window.onSign = () => {
        showHideElement(hiddenFull);
        showHideElement(signatureCapture);
    }

    window.onInsertSignature = () => {
        showHideElement(signatureCapture);
        showHideElement(hiddenFull);
        applySignature();
    }

    window.reset = () => {
        let objects = _canvasDisplay.getObjects();
        for(let i = 0; i < objects.length; i++){
            _canvasDisplay.remove(objects[i]);
        }
        _canvasDisplay.renderAll();
    }

    window.downloadSVG = () => {
        setCanvasState(_currentPage);
        setPageSVG(_currentPage);

        let index = _currentPage-1;

        console.log("==========================================");
        console.log(`Downloading SVG for Page:`, index);
        console.log("==========================================");

        console.log("==========================================");
        console.log(`Content of SVG from Canvas`);
        console.log(_pageSVGs[index]);
        console.log("==========================================");

        let svgBlob = new Blob([_pageSVGs[index]], {type:"image/svg+xml;charset=utf-8"});
        downloadFile(svgBlob, 'mysvg.svg');
    }

    window.toggleTest = () => {
        showHideElement(hiddenFull);
    }

    window.reloadTest = () => {
        loadTest(); // from signup-dev.js for DEV only
    }

    window.undo = () => {
        let objects = _canvasDisplay.getObjects();

        if(objects && objects.length > 0) {
            _canvasDisplay.remove(objects[objects.length-1]);
        }
        _canvasDisplay.renderAll();
    }

    function hasSignature() {
        let validCanvasState = _canvasStates && _canvasStates.length > 0;
        let result = validCanvasState && _canvasStates.findIndex(cs => cs.objectCount > 0) >=0;
        return result;
    }

    function showHideAccept() {
        let hasSigned = hasSignature();

        if (hasSigned) {
            showElement(btnAccept);
        }
        else {
            hideElement(btnAccept);
        }
    }

   window.nextPage = function() {
        // logx(`Current Page: ${_currentPage}`);
        setCanvasState(_currentPage);
        setPageSVG(_currentPage);

        let newPageNum = _currentPage + 1;
        // logx(`New Page: ${newPageNum}`);

        if(newPageNum <= _totalPages) {
            reset();
            let canvasState = getCanvasSate(newPageNum);
            gotoNewCanvasPage(canvasState, newPageNum);
            _currentPage = newPageNum;
            updatePageNumber();
        }
        showHideAccept();
        // logx(JSON.stringify(_canvasStates[_currentPage].svgData));
    }

    window.prevPage = function() {
        setCanvasState(_currentPage);
        setPageSVG(_currentPage);

        let newPageNum = _currentPage - 1;
        if(newPageNum >= 1) {
            reset();
            let canvasState = getCanvasSate(newPageNum);
            gotoNewCanvasPage(canvasState, newPageNum);
            _currentPage = newPageNum;
            updatePageNumber();
        }

        showHideAccept();
    }

    function updatePageNumber() {
        $('pageNumber').innerText = `${_currentPage}/${_totalPages}`;
    }

    window.acceptDocument = () => {
        console.log("==========================================");
        console.log(`Accept called...`);
        oWebViewInterface.emit('onConsoleMessage', 'Accept Called...')
        console.log("==========================================");
        // acceptAndShowWithJsPDF();
        // acceptAndShowWithPDFKitUsingCanvas();

        // ================================================================
        acceptAndShowWithPDFKitUsingSVG();
        // ================================================================

        // ================================================================
        // Following call tries to create the final PDF using PDF Kit
        // I have only tried to do this with One Page
        // Result - FAILED
        // createAndDownLoadDummyPDFUsingPDFKit();
        // ================================================================

        // ================================================================
        /// VERIFIED: Following call is used to Prove that we can send a Base 64 output and get a fully signed PDF
        // RESULT: Passed but doesn't prove anything! We aren't creating the PDF and then getting the Base64
        // createAndDownLoadDummyPDFUsingJSPdf();
        // ================================================================
    }

    const downloadFile = (blob, fileName) => {
        const link = document.createElement('a');
        // create a blobURI pointing to our Blob
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        // some browser needs the anchor to be in the doc
        document.body.append(link);
        link.click();
        link.remove();
        // in case the Blob uses a lot of memory
        setTimeout(() => URL.revokeObjectURL(link.href), 7000);
    };

    var BASE64_MARKER = ';base64,';

    function convertDataURIToBinary(dataURI) {
        var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
        var base64 = dataURI.substring(base64Index);
        var raw = window.atob(base64);
        var rawLength = raw.length;
        var array = new Uint8Array(new ArrayBuffer(rawLength));

        for(i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
        }
        return array;
    }

    function acceptAndShowWithPDFKitUsingSVG () {
        // ---------------------------------------------
        // Creating the final PDF with all the contents
        // ---------------------------------------------
        logAll(`USING PDF KIT Page SVG Count: ${_pageSVGs.length}`);

        if (_pageSVGs && _pageSVGs.length > 0) {
            logAll('Inside using SVG');
            const doc = new PDFDocument({bufferPages: true, size:'A4'});
            // doc.circle(280, 200, 50).fill('#6600FF');
            logAll('Doc created from PDFDocument');

            for (let i = 0; i < _pageSVGs.length; i++) {
                // let imageData = _canvasStates[i].image;
                let imageData = _pageSVGs[i];
                logAll(`SPOT 1 - got first SVG`);
                try{
                    logAll(imageData.toString());

                    // TODO: Sizing the output PDF is in the works
                    //
                    let width = 600;
                    let height = 800;

                    ///doc.path(imageData, {align:'left', valign: 'top'});
                    SVGtoPDFKit(doc, imageData, 0, 0, {
                        width,
                        height,
                        preserveAspectRatio: `${width}x${height}`,
                    });
                }
                catch (e) {
                    logAll('Error' + e.toString());
                }
                // logAll(`SPOT 2 - Added doc.path`);
                doc.addPage();
                // logAll(`Added page`);
            }
            doc.end();
            logAll('Document ended');

            const stream = doc.pipe(blobStream());
            // ---------------------------------------------
            // Serializing the output PDF as a signed Document
            // ---------------------------------------------
            stream.on('finish', function () {
                let blob = stream.toBlob('application/pdf');
                let fReader = new FileReader();
                fReader.addEventListener('loadend', () => {
                    let fileBase64Data = fReader.result;
                    console.log("==========================================");
                    logx(`blob url is:`+ fReader.result);
                    console.log(`blob url is:`+ fReader.result);
                    console.log("==========================================");
                    fileBase64Data = fileBase64Data.replace(/data:application\/pdf;base64,/, '');
                    oWebViewInterface.emit('onAcceptSignUp', fileBase64Data);
                })
                fReader.readAsDataURL(blob);
            });
        }
    }

    function applySignature() {
        _currentSignature = _signaturePad.toDataURL();
        // logx(_currentSignature);

        fabric.Image.fromURL(_currentSignature, (oImg) => {
            _canvasDisplay.add(oImg);
        });

        setCanvasState(_currentPage);
        showHideAccept();
    }

    function newCanvasStateObject(pageNum) {
        let objectCount = _canvasDisplay && _canvasDisplay.getObjects()? _canvasDisplay.getObjects().length: 0;
        return {pageNum: pageNum, data: _canvasDisplay.toJSON(), image: _canvasDisplay.toDataURL(), objectCount: objectCount};
    }

    function setCanvasState(pageNum) {
        if (!_canvasStates) _canvasStates = [];
        let canvasState = newCanvasStateObject(pageNum);

        const pageIndex = _canvasStates.findIndex(p => p.pageNum === pageNum);
        if (pageIndex >= 0) {
            // logx(`Canvas updated for page: ${_currentPage}`);
            _canvasStates[pageIndex] = canvasState
        }
        else {
            // logx(`Canvas recorded for page: ${_currentPage}`);
            _canvasStates.push(canvasState);
        }
    }

    function setPageSVG(pageNum) {
        let index = pageNum - 1;

        if (!_pageSVGs) _pageSVGs = [];
        _pageSVGs[index] = _canvasDisplay.toSVG();

        //logAll('Setting SVG:' + _canvasDisplay.toSVG())
    }

    function getCanvasSate(pageNum) {
        // logx("==========================================");
        // logx(`Getting _canvasDisplay state for: ${pageNum}`);
        // logx("==========================================");

        let retVal = null;
        if (_canvasStates && _canvasStates.length > 0) {
            const pageIndex = _canvasStates.findIndex((p) => {
                // logx(`Checking on: ${p.pageNum}`);
                return p.pageNum === pageNum;
            });
            // logx("==========================================");
            // logx(`Page index is: ${pageIndex}`);
            // logx("==========================================");

            if (pageIndex >= 0) {
                retVal = _canvasStates[pageIndex];
                // logx("==========================================");
                // logx(`Found _canvasDisplay state`);
                // logx("==========================================");
            }
        }
        return retVal;
    }

    function gotoNewCanvasPage(canvasState, pageNum) {
        if (canvasState && canvasState.data) {
            console.log("==========================================");
            console.log(`HAS CANVAS STATE. Going to new page`, pageNum);
            console.log("==========================================");
            // logx("==========================================");
            // logx(`Loading _canvasDisplay state for page: ${pageNum} Canvas State Page: ${canvasState.pageNum}`);
            // logx("==========================================");
            _canvasDisplay.loadFromJSON(canvasState.data, _canvasDisplay.renderAll.bind(_canvasDisplay));
        }
        else {
            console.log("==========================================");
            console.log(`NO CANVAS STATE. Going to new page`, pageNum);
            console.log("==========================================");
            // logx(`Page object is null, will load using file`);
            //logx(`Will go to the Page:` + pageNum);
            window.processPDFFile(_currentPDFB64, pageNum);
        }
    }

    window.showHideElement = function (x) {
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
    }

    window.hideElement = function (x) {
        x.style.display = "none";
    }

    window.showElement = function (x) {
        x.style.display = "block";
    }

    function readBlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            let fileReader = new FileReader();
            fileReader.addEventListener('load', () => {
                console.log(`Resolving...`);
                resolve(fileReader.result)})
            fileReader.addEventListener('error', (err) => {console.log(`Error`, err);});
            fileReader.readAsDataURL(blob);
        })
    }

    async function getPdfData(pdfData) {
        return pdfData instanceof Blob ? await readBlobToBase64(pdfData) : pdfData;
    }

    function getPdfAsBytes(pdfBase64) {
        const Base64Prefix = "data:application/pdf;base64,";

        return atob(pdfBase64.startsWith(Base64Prefix)? pdfBase64.substring(Base64Prefix.length): pdfBase64)
    }

    let canvasDisplay =new fabric.Canvas('canvasDisplay');

    async function onFileChange(event) {
        console.log(`Files:`, this.files[0]);

        // Get the file bytes
        let fileBytes = await getPdfData(this.files[0]);

        //loading task for the document
        const loadingTask = pdfjsLib.getDocument(fileBytes);
        return await loadingTask.promise
            .then((pdf) => {
                pdf.getPage(1)
                    .then((page) => {
                        let viewport = page.getViewport({scale: window.devicePixelRatio});
                        console.log(`Window Device Pixel ratio`, window.devicePixelRatio);
                        const renderContext = {
                            canvasContext: canvasDisplay.getContext('2d'),
                            viewport: viewport
                        }
                        const renderTask = page.render(renderContext);
                        return renderTask.promise.then(() => canvasDisplay);
                    })
            })
    }
    canvasDisplay.setWidth(window.innerWidth-50);
    canvasDisplay.setHeight(window.innerHeight);

    console.log('Starting....');
})();
