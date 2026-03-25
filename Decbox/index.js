/*  ----initialization----  */
window.onload = () => {
    /*  ----middle:auto-padding----    */
    let header_height = document.querySelector(".header").offsetHeight;
    document.querySelector("div.middle").style.paddingTop = header_height + "px";
}
/*  ----elements----    */
let input_file = document.querySelector('#input-file');
let console_row = document.querySelector(".console-row");
let confirm_row = document.querySelector('.confirm-row');
let process_button = confirm_row.querySelector(".process-button");
let download_button = confirm_row.querySelector(".download-button");
let compress_quality_number = document.querySelector(".compress-quality-number");
let compress_quality_range = document.querySelector(".compress-quality-range");
let target_format = document.querySelector(".target-format");
let input_prefix = document.querySelector('.prefix');
let input_suffix = document.querySelector('.suffix');
let display_area = document.querySelector('.display-area');
let input_max_size = document.querySelector('.compress-max-size-number');
let redo_button = document.querySelector('.redo-button');
let undo_button = document.querySelector('.undo-button');
let delete_button = document.querySelector('.delete-button');

/*kit functions*/
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepCopy(item));
    }
    
    const copy = {};
    for (const key in obj) {
        copy[key] = deepCopy(obj[key]);
    }
    return copy;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getExtensionFromFormat(format) {
    if (format === "image/png") {
        return ".png";
    } else if (format === "image/jpeg") {
        return ".jpeg";
    } else if (format === "image/webp") {
        return ".webp";
    }
}

function subFileNameExtension(name) {
    return name.replace(/\.[^.]+$/, '');
}
function changeFileNameExtension(name, extension) {
    return name.replace(/\.[^.]+$/, extension);
}
function downloadFile(file, newName = file.name) {
    let anchor = document.createElement('a');
    let url = URL.createObjectURL(file);
    anchor.href = url;
    anchor.download = newName;
    anchor.click();
    URL.revokeObjectURL(url);
}
function getOptionsForKit(kitName, options) {
    if (kitName === 'browser-image-compression') {
        const result = {
            maxSizeMB: options.maxSizeMB,
            initialQuality: options.quality,
            useWebWorker: options.useWebWorker
        };
        if (options.fileType) {
            result.fileType = options.fileType;
        }
        return result;
    }
}
/*vars*/
const typeToExtention = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
}
const statements = {
    undoIndex: 0,
    doIndex: 0,
    uploading: false,
    processing: false,
    autoProcessing: false,
    autoDownloading: false,
    downloading: false
}
const nameToKit = {
    'browser-image-compression': imageCompression
}
const options = {
    kit: 'browser-image-compression',
    fileType: null,
    quality: 0.7,
    maxSizeMB: 1,
    useWebWorker: true,
    prefix: '',
    suffix: '',
    load: function() {
        this.fileType = target_format.value;
        this.quality = compress_quality_number.value / 100;
        this.maxSizeMB = +input_max_size.value;
        this.prefix = input_prefix.value;
        this.suffix = input_suffix.value;
    },
    forKit: function() {
        return getOptionsForKit(this.kit, this);
    },
    forProcess: function() {
        return [nameToKit[this.kit], this.forKit()];
    }
}
class fileItem {
    constructor(file, name = file.name) {
        this.file = file;
        this.name = name;
        this.status = 'uploaded';
        this.element = null;
        this.id = crypto.randomUUID();
    }
    static copy(obj) {
        const copy = new fileItem(obj.file);
        copy.name = obj.name;
        copy.status = obj.status;
        copy.id = obj.id;
        return copy;
    }
    updateName() {
        let extension = typeToExtention[this.file.type];
        let newName = options.prefix + subFileNameExtension(this.name) + options.suffix + extension;
        this.name = newName;
    }
    bindEvents() {
        this.element.querySelector('.download-button').addEventListener('click', () => {this.download();});
        this.element.querySelector('.delete-button').addEventListener('click', async () => {await removeFileItemByIdFlow(this.id);});
        this.element.querySelector('.process-button').addEventListener('click', async () => {await processFileItemByIdFlow(this.id);});
    }
    unbindEvents() {
        this.element.querySelector('.download-button').removeEventListener('click', () => {this.download();});
        this.element.querySelector('.delete-button').removeEventListener('click', async () => {await removeFileItemByIdFlow(this.id);});
        this.element.querySelector('.process-button').removeEventListener('click', async () => {await processFileItemByIdFlow(this.id);});

    }
    createElement() {
        let element = document.createElement('field');
        element.className = 'file-item';
        element.innerHTML = `
            <div class="left">
                <img src="svgs/icons/file.svg">
                <span class="file-name">${this.name}</span>
                <span class="file-size">${formatSize(this.file.size)}</span>
            </div>
            <div class="right">
                <span class='status'>${this.status}</span>
                <input class='process-button' type='button' value='process'>
                <input class='download-button' type='button' value='download'>
                <input class='delete-button' type='button' value='del'>
            </div>
            `
        display_area.appendChild(element);
        this.element = element;
    }
    removeElement() {
        this.element.remove();
    }
    updateElement() {
        let element = this.element;
        element.querySelector('.file-name').innerHTML = `${this.name}`;
        element.querySelector('.file-size').innerHTML = `${formatSize(this.file.size)}`;
        element.querySelector('.status').innerHTML = `${this.status}`;
    }
    async process(processOptions) {
        this.status = 'processing';
        const kit = processOptions[0];
        const kitOptions = processOptions[1];
        console.log(kitOptions);
        console.log(kit);
        this.file = await kit(this.file, kitOptions);
        this.updateName();
        this.status = 'processed';
    }
    download() {
        downloadFile(this.file, this.name);
    }
}
class fileItemsArray {
    constructor() {
        this.array = [];
        this.item = fileItem;
    }
    static copy(obj) {
        const copy = new fileItemsArray;
        for (let i = 0; i < obj.array.length; i++) {
            const item = obj.array[i];
            const copyItem = copy.item.copy(item);
            copy.array.push(copyItem);
        }
        return copy;
    }
    createItem(file, name) {
        let item = new this.item(file, name);
        this.array.push(item);
    }
    selectItemById(id) {
        for (let i = 0; i < this.array.length; i++) {
            let item = this.array[i]
            if (item.id === id) {
                return item;
            }
        }
    }
    removeItemById(id) {
        this.array = this.array.filter(i => i.id !== id);
    }
    downloadAll() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.download();
        }
    }
    async processAll(processOptions) {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            await fileItem.process(processOptions);
        }
    }
    unbindAllEvents() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.unbindEvents();
        }
    }
    removeAllElements() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.removeElement();
        }
    }
    updateAllElements() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.updateElement();
        }
    }
    createAllElements() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.createElement();
        }
    }
    bindAllEvents() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.bindEvents();
        }
    }
    updateAllElements() {
        for (let i = 0; i < this.array.length; i++) {
            const fileItem = this.array[i];
            fileItem.updateElement();
        }
    }
    removeAll() {
        this.array = [];
    }
}
class version {
    constructor() {
        this.fileItems = new fileItemsArray;
    }
    static copy(obj) {
        const copy = new version;
        for (let i = 0; i < obj.fileItems.array.length; i++) {
            const item = obj.fileItems.array[i];
            const copyItem = copy.fileItems.item.copy(item);
            copy.fileItems.array.push(copyItem);
        }
        return copy;
    }
}
const versionHistory = {
    index: 0,
    versions: [new version],
    getVer() {
        return this.versions[this.index];
    },
    createVerElements() {
        this.getVer().fileItems.createAllElements();
    },
    bindVerEvents() {
        this.getVer().fileItems.bindAllEvents();
    },
    unbindVerEvents() {
        this.getVer().fileItems.unbindAllEvents();
    },
    updateVerElements() {
        this.getVer().fileItems.updateAllElements();
    },
    removeVerElements() {
        this.getVer().fileItems.removeAllElements();
    },
    back(num) {
        this.removeVerElements();
        for (let i = 0; i < num; i++) {
            this.index--;
        }
        this.createVerElements();
        this.bindVerEvents();
    },
    forward(num) {
        this.removeVerElements();
        for (let i = 0; i < num; i++) {
            this.index++;
        }
        this.createVerElements();
        this.bindVerEvents();
    },
    copyPreVer() {
        return version.copy(this.versions[this.index - 1]);
    },
    async updateVer(callBack) {
        this.unbindVerEvents();
        this.removeVerElements();
        this.index++;
        this.versions[this.index] = this.copyPreVer();
        await callBack(this.getVer());
        this.createVerElements();
        this.bindVerEvents();
        statements.undoIndex++;
        statements.doIndex = 0;
        updateUndoButton();
        updateRedoButton();
    }
}
/*flow*/
function uploadFilesFlow() {
    statements.uploading = true;
    updateInputFile();

    versionHistory.updateVer((ver) => {
        const array = Array.from(input_file.files);
        array.forEach((file) => {
            ver.fileItems.createItem(file);
        });
    });

    statements.uploading = false;
    input_file.value = '';
    updateInputFile();
}
async function processFileItemByIdFlow(id) {
    statements.processing = true;
    updateProcessButton();
    
    await versionHistory.updateVer(async (ver) => {
        options.load();
        let processOptions = options.forProcess();
        await ver.fileItems.selectItemById(id).process(processOptions);
    });

    statements.processing = false;
    updateProcessButton();
}
async function processFileItemsFlow() {
    statements.processing = true;
    updateProcessButton();
    
    await versionHistory.updateVer(async (ver) => {
        options.load();
        let processOptions = options.forProcess();
        await ver.fileItems.processAll(processOptions);
    });

    statements.processing = false;
    updateProcessButton();
}
function removeFileItemByIdFlow(id) {
    statements.processing = true;
    updateProcessButton();
    
    versionHistory.updateVer((ver) => {
        ver.fileItems.removeItemById(id);
    });

    statements.processing = false;
    updateProcessButton();
}
function removeFileItemsFlow() {
    statements.processing = true;
    updateProcessButton();
    
    versionHistory.updateVer((ver) => {
        ver.fileItems.removeAll();
    });

    statements.processing = false;
    updateProcessButton();
}
function downloadFileItemsFlow() {
    statements.downloading = true;
    updateDownloadButton();

    options.load();
    versionHistory.updateVer((ver) => {
        ver.fileItems.downloadAll();
    });

    statements.downloading = false;
    updateDownloadButton();
}
function undoFlow() {
    versionHistory.back(1);
    statements.undoIndex--;
    statements.doIndex++;
    updateUndoButton();
    updateRedoButton();
}
function redoFlow() {
    versionHistory.forward(1);
    statements.undoIndex++;
    statements.doIndex--;
    updateUndoButton();
    updateRedoButton();
}
/*UIupdate*/
function updateConsoleRow() {
    if (statements.processing) {
        console_row.toggleAttribute('disabled', true);
    } else {
        console_row.toggleAttribute('disabled', false);
    }
}
function updateUndoButton() {
    if (statements.undoIndex <= 0) {
        undo_button.toggleAttribute('disabled', true);
    } else {
        undo_button.toggleAttribute('disabled', false);
    }
}
function updateRedoButton() {
    if (statements.doIndex <= 0) {
        redo_button.toggleAttribute('disabled', true);
    } else {
        redo_button.toggleAttribute('disabled', false);
    }
}
function updateInputFile() {
    if (statements.uploading) {
        input_file.toggleAttribute('disabled', true);
    } else {
        input_file.toggleAttribute('disabled', false);
    }
}
function updateProcessButton() {
    if (statements.processing) {
        process_button.toggleAttribute('disabled', true);
    } else {
        process_button.toggleAttribute('disabled', false);
    }
}
function updateDownloadButton() {
    if (statements.downloading) {
        download_button.toggleAttribute('disabled', true);
    } else {
        download_button.toggleAttribute('disabled', false);
    }
}
/*event*/
compress_quality_number.addEventListener("input", () =>{
    compress_quality_range.value = compress_quality_number.value;
});
compress_quality_range.addEventListener("input", () =>{
    compress_quality_number.value = compress_quality_range.value;
});
undo_button.addEventListener('click', undoFlow);
redo_button.addEventListener('click', redoFlow);

input_file.addEventListener('change', uploadFilesFlow);

delete_button.addEventListener('click', removeFileItemsFlow)
process_button.addEventListener('click', processFileItemsFlow);
download_button.addEventListener('click', downloadFileItemsFlow);

// /*  ----definitions---- */
//     /*  undefined   */
// let file_items = [];
//     /*  objects */
// var statements = new Object();
// statements.kit = 'browser-image-compression';
// statements.autoProcess = () => {return auto_process.checked;}
// statements.autoDownload = () => {return auto_download.checked;}
// statements.inProgress = false;
// statements.processable = false;
// statements.downloadable = false;
// statements.undoIndex = 0;
// statements.doIndex = 0;
// statements.updateDOM = function updateWidgets() {
//     updateConsoleRow();
//     updateProcessButton();
//     updateDownloadButton();
//     updateInputFile();
//     updateUndoButton();
//     updateDoButton();
//     updateDownloadButton();
// }
// var fileProcessOptions = new Object();
// fileProcessOptions.kit = 'browser-image-compression';
// fileProcessOptions.targetFormat = 'original';
// fileProcessOptions.prefix = false;
// fileProcessOptions.suffix = false;
// fileProcessOptions.quality = false;
// fileProcessOptions.maxSizeMB = false;
// fileProcessOptions.update = function updatefileProcessOptions() {
//     this.kit = statements.kit;
//     this.targetFormat = target_format.value;
//     this.prefix = input_prefix.value;
//     this.suffix = input_suffix.value;
//     this.quality = compress_quality_number.value / 100;
//     this.maxSizeMB = input_max_size.value;
// }
// /*  ----kits----    */
//     /*  format-size */
// function formatSize(bytes) {
//     if (bytes < 1024) return bytes + ' B';
//     if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
//     return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
// }
// /*  ----functions----   */
//     /*  mainprocessfile */
// async function processFile(file) {
//     fileProcessOptions.update();
//     if (fileProcessOptions.kit === 'browser-image-compression') {
//         return await processFileByBrowserImageCompression(file);
//     }
// }
//     /*  browser-image-compression   */
// async function processFileByBrowserImageCompression(file) {
// //    fileProcessOptions.update();  from processFile()
//     let target_format_ = fileProcessOptions.targetFormat;
//     const options = {
//         'maxSizeMB': fileProcessOptions.maxSizeMB,
//         'quality': fileProcessOptions.quality,
//         'useWebWorker': true
//     }
//     if (target_format_ !== 'original') {
//         options["fileType"] = target_format_;
//     }
//     let result = await imageCompression(file, options);
//     return result;
// }
//     /*   file-item-entity   */
// function createFileItem(file_) {
//     let element_ = document.createElement('div');
//     element_.className = 'file-item';
//     element_.innerHTML = `
//         <div class="left">
//             <img src="svgs/icons/file.svg">
//             <span class="file-name">${file_.name}</span>
//             <span class="file-size">${formatSize(file_.size)}</span>
//         </div>
//         <div class="right">
//             <span class='status'>uploaded</span>
//         </div>
//     `;
//     display_area.appendChild(element_);
//     this.statuses = [],
//     this.downloadLink = false,
//     this.element = element_,
//     this.processOptions = [],
//     this.files = [],
//     this.index = 0,
//     this.statuses.push('uploaded');
//     this.files.push(file_);
// //    this.getFile = () => {return this.files[this.files.length - 1];}
// }
// createFileItem.prototype.getFile = function() {return this.files[this.index];}
// createFileItem.prototype.getStatus = function() {return this.statuses[this.index]}
// createFileItem.prototype.remove = function() {
//     this.element.remove();
//     URL.revokeObjectURL(this.downloadLink);
//     file_items = file_items.filter(i => i !== this);
// }
// createFileItem.prototype.updateDOM = function fileItemUpdate() {
//     if (this.index >= 0) {
//         let file = this.getFile();
//         this.element.innerHTML = `
//             <div class="left">
//                 <img src="svgs/icons/file.svg">
//                 <span class="file-name">${file.name}</span>
//                 <span class="file-size">${formatSize(file.size)}</span>
//             </div>
//             <div class="right">
//                 <span class='status'>${this.getStatus()}</span>
//             </div>
//         `;
//     }
// }
// createFileItem.prototype.process = async function processFileItem() {
//     if (this.index >= 0) {
//         let last_status = this.statuses[this.index];
//         this.statuses[this.index] =  'processing';
//         this.updateDOM();
//         fileProcessOptions.update();
//         let file = this.getFile();
//         let result = await processFile(file);
//         let link = document.createElement('a');
//         let url = URL.createObjectURL(result);
//         let new_name = getNewFileName(file.name);
//         let new_size = result.size;
//         let size_change = new_size - file.size;
//         link.href = url;
//         link.download = new_name;
//         if (size_change < 0) {
//             this.statuses[this.index + 1] =  `-${formatSize(-size_change)}  processed`;
//         } else if (size_change > 0) {
//             this.statuses[this.index + 1] =  `+${formatSize(size_change)}  processed`;
//         } else {
//             this.statuses[this.index + 1] =  `*0  processed`;
//         }
//         result.name = new_name;
//         this.downloadLink = link;
//         this.files[this.index + 1] =  result;
//         this.processOptions[this.index] =  fileProcessOptions;
//         this.statuses[this.index] = last_status;
//         this.index++;
//     } else {
//         this.index++;
//     }
//     this.updateDOM();
// }
// createFileItem.prototype.download = function fileItemDownload() {
//     let download_link = this.downloadLink;
//     if (download_link) {
//         this.statuses[this.index] =  'downloading';
//         this.updateDOM();
//         download_link.click();
//         this.statuses[this.index] =  'downloaded';
//         this.updateDOM();
//     }
// }
// createFileItem.prototype.undo = function undoFileItem() {
//     this.index--;
//     this.updateDOM();
// }
// createFileItem.prototype.do = function doFileItem() {
//     this.index++;
//     this.updateDOM();
// }
//     /*  getnew file name    */
// function getNewFileName(name) {
//     const prefix = fileProcessOptions.prefix;
//     const suffix = fileProcessOptions.suffix;
//     const target_format_ = fileProcessOptions.targetFormat;
//     const nameWithoutExt = name.replace(/\.[^.]+$/, '');
//     const extMap = {
//         'original': name.match(/\.[^.]+$/)[0],
//         'image/jpeg': '.jpg',
//         'image/png': '.png',
//         'image/webp': '.webp'
//     }
//     return prefix + nameWithoutExt + suffix + extMap[target_format_];
// }
//     /*  updateDOMs  */
// function updateConsoleRow() {
//     if (statements.inProgress) {
//         console_row.toggleAttribute('disabled', true);
//     } else {
//         console_row.toggleAttribute('disabled', false);
//     }
// }
// function updateProcessButton() {
//     if (statements.inProgress) {
//         process_button.toggleAttribute('disabled', true);
//     } else {
//         if (statements.autoProcess()) {
//             process_button.toggleAttribute('disabled', true);
//         } else {
//             if (!statements.processable) {
//                 process_button.toggleAttribute('disabled', true);
//             } else {
//                 process_button.toggleAttribute('disabled', false);
//             }
//         }
//     }
// }
// function updateDownloadButton() {
//     if (statements.inProgress) {
//         download_button.toggleAttribute('disabled', true);
//     } else {
//         if (statements.autoDownload()) {
//             download_button.toggleAttribute('disabled', true);
//         } else {
//             if (!statements.downloadable) {
//                 download_button.toggleAttribute('disabled', true);
//             } else {
//                 download_button.toggleAttribute('disabled', false);
//             }
//         }
//     }
// }
// function updateInputFile() {
//     if (statements.inProgress) {
//         input_file.toggleAttribute('disabled', true);
//     } else {
//         input_file.toggleAttribute('disabled', false);
//     }
// }
// function updateUndoButton() {
//     if (statements.inProgress) {
//         undo_button.toggleAttribute('disabled', true);
//     } else {
//         if (statements.undoIndex <= 0) {
//             undo_button.toggleAttribute('disabled', true);
//         } else {
//             undo_button.toggleAttribute('disabled', false);
//         }
//     }
// }
// function updateDoButton() {
//     if (statements.inProgress) {
//         do_button.toggleAttribute('disabled', true);
//     } else {
//         if (statements.doIndex <= 0) {
//             do_button.toggleAttribute('disabled', true);
//         } else {
//             do_button.toggleAttribute('disabled', false);
//         }
//     }
// }
//     /*  process process */
// async function processFileItems() {
//     statements.inProgress = true;
//     statements.updateDOM();
//     fileProcessOptions.update();
//     if (file_items.length !== 0) {
//         for (let let i = 0; i < file_items.length; i++) {
//             await file_items[i].process();
//         }
//         statements.downloadable = true;
//     }
//     statements.undoIndex++;
//     statements.doIndex = 0;
//     statements.inProgress = false;
//     if (statements.autoDownload()) {
//         downloadFileItems();
//     }
//     statements.updateDOM();
// }
//     /*  downloadall */
// function downloadFileItems() {
//     statements.inProgress = true;
//     statements.updateDOM();
//     if (statements.downloadable) {
//         for (let let i = 0; i < file_items.length; i++) {
//             let file_item = file_items[i];
//             file_item.download();
//             setTimeout(() => {
//                 file_item.remove();
//             }, 800);
//         }
//     }
//     statements.inProgress = false;
//     statements.downloadable = false;
//     statements.updateDOM();
// }
// function undoFileItems() {
//     statements.inProgress = true;
//     statements.updateDOM();
//     file_items.forEach((file_item) => {
//         file_item.undo();
//     });
//     statements.undoIndex--;
//     statements.doIndex++;
//     statements.inProgress = false;
//     statements.updateDOM();
// }
// function doFileItems() {
//     statements.inProgress = true;
//     statements.updateDOM();
//     file_items.forEach((file_item) => {
//         file_item.do();
//     });
//     statements.undoIndex++;
//     statements.doIndex--;
//     statements.inProgress = false;
//     statements.updateDOM();
// }
// /*  ----eventlisteners----  */
//     /*  compress quality elements:linkage    */
// compress_quality_number.addEventListener("input", () =>{
//     compress_quality_range.value = compress_quality_number.value;
// });
// compress_quality_range.addEventListener("input", () =>{
//     compress_quality_number.value = compress_quality_range.value;
// });
//     /*  input file  */
// input_file.addEventListener('change', async () => {
//     if (!statements.inProgress) {
//         statements.inProgress = true;
//         updateInputFile();
//         const new_files = Array.from(input_file.files);
//         for (let let i = 0; i < new_files.length; i++) {
//             file_items.push(new createFileItem(new_files[i]));
//         }
//         statements.processable = true;
//         input_file.value = '';
//         statements.inProgress = false;
//         updateProcessButton();
//         updateInputFile();
//         if (statements.autoProcess()) {
//             await processFileItems();
//         }
//     }
// });
//     /*  autos   */
// auto_process.addEventListener('input', async (e) => {
//     e.preventDefault();
//     if (!auto_process.checked) {
//         auto_process.checked = false;
//         updateProcessButton();
//     } else {
//         auto_process.checked = true;
//         updateProcessButton();
//         if (!statements.inProgress) {
//             await processFileItems();
//         }
//     }
// });
// auto_download.addEventListener('input', (e) => {
//     e.preventDefault();
//     if (!auto_download.checked) {
//         auto_download.checked = false;
//         updateDownloadButton();
//     } else {
//         auto_download.checked = true;
//         updateDownloadButton();
//         if (!statements.inProgress) {
//             downloadFileItems();
//         }
//     }
// });
//     /*  buttons */
// process_button.addEventListener("click", async () => {
//     if (!statements.inProgress) {
//         await processFileItems();
//     }
// });
// download_button.addEventListener('click', () => {
//     if (!statements.inProgress) {
//         downloadFileItems();
//     }
// });
// undo_button.addEventListener('click', () => {
//     if (!statements.inProgress) {
//         undoFileItems();
//     }
// });
// do_button.addEventListener('click', () => {
//     if (!statements.inProgress) {
//         doFileItems();
//     }
// });





// /*
// /*  ----process_button availability control---- */
// let input_file = document.querySelector("#input-file");
// let file_items = [];

// input_file.addEventListener("change", () => {
//     const new_files = Array.from(input_file.files);
//     for (let i = 0; i < new_files.length; i++) {
//         file_items.push(new createFileItem(new_files[i]));
//     }
//     input_file.value = '';
//     if (auto_process.checked) {
//         process_button.toggleAttribute('disabled', true);
//         if (file_items.length > 0) {
//             if (!in_process) {
//                 fileCanvasModeProcess();
//             } else {
//                 return null;
//             }
//         }
//     } else {
//         if (file_items.length > 0) {
//             if (!in_process) {
//                 process_button.toggleAttribute("disabled", false);
//             } else {
//                 return null;
//             }
//         } else {
//             process_button.toggleAttribute("disabled", true);
//         }
//     }
// });
// /*  ----buttons availability control---- */
// auto_process.addEventListener('input', () => {
//     if (auto_process.checked) {
//         process_button.toggleAttribute("disabled", true);
//         if (file_items.length > 0) {
//             fileCanvasModeProcess();
//         } else {
//             return null;
//         }
//     } else {
//         if (file_items.length > 0) {
//             if (!in_process) {
//                 process_button.toggleAttribute("disabled", false);
//             } else {
//                 return null;
//             }
//         } else {
//             process_button.toggleAttribute("disabled", true);
//         }
//     }
// });
// auto_download.addEventListener('input', () => {
//     if (auto_download.checked) {
//         download_button.toggleAttribute("disabled", true);
//         downloadFileItems();
//     } else {
//         if (dowmload_links.length == 0) {
//             download_button.toggleAttribute("disabled", true);
//         } else {
//             download_button.toggleAttribute("disabled", false);
//         }
//     }
// });
// /*  ----confirm-row process-button => process----    */
// /*let process_button = ____*/
// /*let input_file = ____*/
// const canvas = document.createElement("canvas");
// const canvas_context = canvas.getContext('2d');
// let in_process = false;
// let target_type = null;
// let file_extension = null;
// let dowmload_links = [];

// function fileItemDownload(file_item_) {
//     file_item_.downloadLink.click();
//     file_item_.status = 'downloaded';
//     file_item_.updateDOM();
//     setTimeout(() => {
//         file_item_.remove();
//     }, 800);
// }
// createFileItem.prototype.download = fileItemDownload();
// function fileProcessByCanvas(file_item_, target_type_, compress_quality_, file_extension_ = null, prefix_ = "processed_", suffix_ = "") {
//     const img = new Image();
//     img.src = URL.createObjectURL(file_item_.file);
//     img.onload = () => {
//         canvas.width = img.width;
//         canvas.height = img.height;
//         canvas_context.drawImage(img, 0, 0);
//         if (target_type_ === "original") {
//             const result_name = prefix_ + file_item_.file.name.replace(/(\.[^.]+$)/, (suffix_ + '$1'));
//             const link = document.createElement('a');
//             result = canvas.toBlob(blob => {
//                 const url = URL.createObjectURL(blob);
//                 link.href = url;
//                 file_item_.size = formatSize(blob.size);
//             }, file_item_.file.type, compress_quality_);
//             link.download = result_name;
//             file_item_.downloadLink = link;
//             file_item_.name = result_name;
//             file_item_.results.push(result);
//             file_item_.processes.push('canvasAPI');
//             file_item_.status = 'processed';
//             file_item_.updateDOM();
//             if (auto_download.checked) {
//                 file_item_.download();
//             } else {
//                 return;
//             }
//         } else {
//             const result_name = prefix_ + file_item_.file.name.replace(/\.[^.]+$/, (suffix_ + file_extension_));
//             const link = document.createElement('a');
//             canvas.toBlob(blob => {
//                 const url = URL.createObjectURL(blob);
//                 link.href = url;
//             }, target_type_, compress_quality_);
//             link.download = result_name;
//             file_item_.downloadLink = link;
//             file_item_.name = result_name;
//             file_item_.results.push(result);
//             file_item_.processes.push('canvasAPI');
//             file_item_.status = 'processed';
//             file_item_.updateDOM();
//             if (auto_download.checked) {
//                 file_item_.download();
//             } else {
//                 return;
//             }
//         }
//         download_button.toggleAttribute('disabled', false);
//     }
// }
// function fileCanvasModeProcess() {
//     console_row.toggleAttribute("disabled", true);
//     in_process = true;
//     /*values*/
//     let prefix = input_prefix.value;
//     let suffix = input_suffix.value;
//     let compress_quality = compress_quality_number.value / 100;
//     target_type = target_format.value;
//     if (target_type === "original") {
//         for (let let i = 0; i < file_items.length; i++) {
//             const file_item = file_items[i];
//             fileProcessByCanvas(file_item, "original", compress_quality, null, prefix, suffix);
//         }
//     } else {
//         file_extension = fileTypeToExtension(target_type);
//         for (let let i = 0; i < file_items.length; i++) {
//             const file_item = file_items[i];
//             fileProcessByCanvas(file_item, target_type, compress_quality, file_extension, prefix, suffix);
//         }
//     }
//     console_row.toggleAttribute("disabled", false);
//     in_process = false;
//     file_items = [];
// }
// function fileTypeToExtension(file_type_) {
//     if (file_type_ === "image/png") {
//         return ".png";
//     } else if (file_type_ === "image/jpeg") {
//         return ".jpeg";
//     } else if (file_type_ === "image/webp") {
//         return ".webp";
//     }
// }

// process_button.addEventListener("click", () => {
//     process_button.toggleAttribute("disabled", true);
//     fileCanvasModeProcess();
// });
// /*  ----download <= download-button---- */
// function downloadFileItems() {
//     for (let i = 0; i < file_items.length; i++) {
//         let file_item = file_items[i];
//         file_item.download();
//     }
// }
// download_button.addEventListener('click', () => {
//     downloadFileItems();
//     download_button.toggleAttribute('disabled', true);
// });
