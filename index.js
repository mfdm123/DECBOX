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
    isEmpty() {
        if (this.array.length === 0) {
            return true;
        } else {
            return false;
        }
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
        updateProcessButton();
        updateDownloadButton();
        updateDeleteButton();
    },
    forward(num) {
        this.removeVerElements();
        for (let i = 0; i < num; i++) {
            this.index++;
        }
        this.createVerElements();
        this.bindVerEvents();
        updateProcessButton();
        updateDownloadButton();
        updateDeleteButton();
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
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();

    versionHistory.updateVer((ver) => {
        const array = Array.from(input_file.files);
        array.forEach((file) => {
            ver.fileItems.createItem(file);
        });
    });

    statements.uploading = false;
    input_file.value = '';
    updateInputFile();
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
}
async function processFileItemByIdFlow(id) {
    statements.processing = true;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
    
    await versionHistory.updateVer(async (ver) => {
        options.load();
        let processOptions = options.forProcess();
        await ver.fileItems.selectItemById(id).process(processOptions);
    });

    statements.processing = false;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
}
async function processFileItemsFlow() {
    statements.processing = true;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
    
    await versionHistory.updateVer(async (ver) => {
        options.load();
        let processOptions = options.forProcess();
        await ver.fileItems.processAll(processOptions);
    });

    statements.processing = false;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
}
function removeFileItemByIdFlow(id) {
    statements.processing = true;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
    
    versionHistory.updateVer((ver) => {
        ver.fileItems.removeItemById(id);
    });

    statements.processing = false;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
}
function removeFileItemsFlow() {
    statements.processing = true;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
    
    versionHistory.updateVer((ver) => {
        ver.fileItems.removeAll();
    });

    statements.processing = false;
    updateProcessButton();
    updateDownloadButton();
    updateDeleteButton();
}
function downloadFileItemsFlow() {
    statements.downloading = true;
    updateDownloadButton();
    updateDownloadButton();
    updateDeleteButton();

    options.load();
    versionHistory.getVer().fileItems.downloadAll();

    statements.downloading = false;
    updateDownloadButton();
    updateDownloadButton();
    updateDeleteButton();
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
    if (!statements.processing && !versionHistory.getVer().fileItems.isEmpty()) {
        process_button.toggleAttribute('disabled', false);
    } else {
        process_button.toggleAttribute('disabled', true);
    }
}
function updateDownloadButton() {
    if (!statements.processing && !versionHistory.getVer().fileItems.isEmpty()) {
        download_button.toggleAttribute('disabled', false);
    } else {
        download_button.toggleAttribute('disabled', true);
    }
}
function updateDeleteButton() {
    if (!statements.processing && !versionHistory.getVer().fileItems.isEmpty()) {
        delete_button.toggleAttribute('disabled', false);
    } else {
        delete_button.toggleAttribute('disabled', true);
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
