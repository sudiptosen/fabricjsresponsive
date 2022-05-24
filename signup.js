pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';

(async function() {
    let canvasDisplay =new fabric.Canvas('c');

    let $ = (id) => {return document.getElementById(id)};

    function readBlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            let fileReader = new FileReader();
            fileReader.addEventListener('load',
                () => {resolve(fileReader.result)});
            fileReader.addEventListener('error', (err) => {console.log(`Error`, err);});
            fileReader.readAsDataURL(blob);
        })
    }

    async function getPdfData(pdfData) {
        return pdfData instanceof Blob ? await readBlobToBase64(pdfData) : pdfData;
    }


    async function onFileChange() {
        let fileBytes = await getPdfData(this.files[0]);

        const loadingTask = pdfjsLib.getDocument(fileBytes);
        return await loadingTask.promise
            .then((pdf) => {
                pdf.getPage(1)
                    .then((page) => {
                        let viewport = page.getViewport({scale: 1.5});
                        const renderContext = {
                            canvasContext: canvasDisplay.getContext('2d'),
                            viewport: viewport
                        }
                        page.render(renderContext);
                    })
            })
    }
    canvasDisplay.setWidth(window.innerWidth-20);
    canvasDisplay.setHeight(window.innerHeight);
    $("fileInput").addEventListener('change', onFileChange);
})();
