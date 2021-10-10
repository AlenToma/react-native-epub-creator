import { zip, unzip, subscribe, } from 'react-native-zip-archive'
import EpubFile, { EpubSettings, File, EpubChapter, EpubSettingsLoader, Parameter, EpubJsonSettings, jsonExtractor, bodyExtrator } from 'epub-constructor'
import { v4 as uuidv4 } from 'uuid';

export type ReadDirItem = {
    path: string // The absolute path to the item
    isFile: () => boolean // Is the file just a file?
    isDirectory: () => boolean // Is the file a directory?
}

export type {
    File,
    EpubChapter,
    EpubSettings,
    Parameter,
    EpubSettingsLoader,
    EpubJsonSettings,
    jsonExtractor,
    bodyExtrator
}

/*
    file reader settings
    best use with react-native-fs
*/
export interface FsSettings {
    writeFile: (filepath: string, contents: string, encodingOrOptions?: any) => Promise<void>;
    mkdir: (filePath: string) => Promise<void>;
    unlink: (filePath: string) => Promise<void>;
    exists: (filePath: string) => Promise<boolean>;
    readFile: (filePath: string, encodingOrOptions?: any) => Promise<string>;
    readDir: (filePath: string) => Promise<ReadDirItem[]>;
}


const checkFile = (path: string) => {
    var name = path.split("/").reverse()[0].toLocaleLowerCase();
    var fileExtension = [".json", ".html", ".xml", ".opf", ".ncx", ".css", "mimetype", ".epub"]
    return {
        isDirectory: !fileExtension.find(x => name.indexOf(x) !== -1),
        folderPath: fileExtension.find(x => name.indexOf(x) !== -1) ? path.split("/").reverse().filter((x, index) => index > 0).reverse().join("/") : path
    }
}


const validateDir = async (path: string, reader: FsSettings) => {
    path = getFolderPath(path);
    if (!(await reader.exists(path))) {
        await reader.mkdir(path);
    }
}

const getFolderPath = (path: string) => {
    var file = checkFile(path);
    return file.folderPath;
}


const getFiles = async (folder: string, reader: FsSettings) => {
    var fs = await reader.readDir(folder);
    var files = [] as ReadDirItem[];
    for (var f of fs) {
        if (f.isFile())
            files.push(f);
        else if (f.isDirectory()) {
            files = [...files, ...(await getFiles(f.path, reader))]
        }
    }
    return files;
}





export const EpubLoader = async (epubPath: string, RNFS: FsSettings, localOnProgress?: (progress: number, file: string) => void, onEpubExtractionsProgress?: (progress: number, file: string) => void) => {
    if (!await RNFS.exists(epubPath))
        throw "Epub File could not be found.";

    var sub = subscribe(({ progress, filePath }: { progress: number, filePath: string }) => {
        if (filePath === epubPath) {
            onEpubExtractionsProgress?.(progress * 100, epubPath);
        }
    })
    const destinationFolder = getFolderPath(epubPath)
    const tempFolder = destinationFolder + "/" + uuidv4();
    await validateDir(tempFolder, RNFS);
    await unzip(epubPath, tempFolder, "UTF-8");
    const epubFiles = [] as File[];
    const files = await getFiles(tempFolder, RNFS);
    const len = files.length + 1;
    var dProgress = 0;
    const jsonFile = files.find(x => x.path.endsWith(".json"));
    if (!jsonFile) {
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            dProgress = ((i / parseFloat(len.toString())) * 100)
            if (f.isFile()) {
                var file = {
                    path: f.path.replace(tempFolder, ""),
                    content: await RNFS.readFile(f.path)
                } as File
                epubFiles.push(file);
                EpubBuilder.onProgress?.(dProgress, epubPath, "Reading");
                localOnProgress?.(dProgress, epubPath);
            }
        }
    } else epubFiles.push({
        path: jsonFile.path.replace(tempFolder, ""),
        content: await RNFS.readFile(jsonFile.path)
    } as File)
    sub.remove();
    await RNFS.unlink(tempFolder);
    dProgress = ((len / parseFloat(len.toString())) * 100)
    var item = new EpubBuilder(await EpubSettingsLoader(epubFiles, (p) => {
        onEpubExtractionsProgress?.(p, epubPath);
    }), destinationFolder, RNFS);
    EpubBuilder.onProgress?.(dProgress, epubPath, "Reading");
    localOnProgress?.(dProgress, epubPath);
    return item
}

export default class EpubBuilder {
    private settings: EpubSettings;
    static onProgress?: (progress: number, epubFile: string, operation: "constructEpub" | "SaveFile" | "LoadingFile" | "Zip" | "Unzip" | "Reading") => void;
    private destinationFolderPath?: string;
    private tempPath?: string;
    private RNFS: FsSettings;
    private dProgress: number = 0;
    public onSaveProgress?: (progress: number, epubFile: string, operation: "constructEpub" | "SaveFile") => Promise<void>

    /*
    destinationFolderPath: destination to the folder, You could use react-native-fs RNFS.DownloadDirectoryPath
    */
    constructor(settings: EpubSettings, destinationFolderPath: string, RNFS: FsSettings) {
        this.settings = settings;
        this.destinationFolderPath = getFolderPath(destinationFolderPath);
        this.RNFS = RNFS;
    }

    public getEpubSettings() {
        return this.settings;
    }

    /*
        This will prepare a temp folder that containe the data of the epub file.
        the folder will be descarded when the epub file is created eg save() or discardChanges() 
    */
    public async prepare() {
        await this.createTempFolder();
        return this;
    }
    /*
        discard all changes
    */
    public async discardChanges() {
        try {
            console.log("Removing:" + this.tempPath);
            if (this.tempPath)
                if (await this.RNFS.exists(this.tempPath))
                    await this.RNFS.unlink(this.tempPath);
            this.tempPath = undefined;
        } catch (error) {
            console.log(error);
        }
    }
    /*
        add a new Chapter
    */
    public async addChapter(epubChapter: EpubChapter) {
        this.settings.chapters.push(epubChapter);
        await this.createTempFolder();
    }

    /*
    destinationFolderPath: destination to the folder, You could use react-native-fs RNFS.DownloadDirectoryPath
    RNFS: file reader settings best use with react-native-fs eg import * as RNFS from 'react-native-fs', or you could use your own filereder
    removeTempFile(default true) set to false if there will be other changes to the epub file so it wont have to recreate the temp folder
    */
    public async save(removeTempFile?: boolean) {

        const targetPath = `${this.destinationFolderPath}/${this.settings.title}.epub`


        await this.createTempFolder();
        try {
            if (await this.RNFS.exists(targetPath))
                await this.RNFS.unlink(targetPath);
        } catch (error) {
            console.log("unable to delete the existing: " + targetPath)
        }
        if (this.tempPath)
            await zip(this.tempPath, targetPath);
        if (removeTempFile !== false)
            await this.discardChanges();
        return targetPath;
    }

    private async createTempFolder() {
        const targetPath = `${this.destinationFolderPath}/${this.settings.title}.epub`
        var overrideFiles = ["toc.ncx", "toc.html", ".opf", ".json"]
        const epub = new EpubFile(this.settings);
        const files = await epub.constructEpub(async (progress) => {
            if (this.onSaveProgress)
                await this.onSaveProgress?.(progress, targetPath, "constructEpub")
        });
        this.tempPath = this.tempPath ?? (this.destinationFolderPath + "/" + uuidv4());
        await validateDir(this.tempPath, this.RNFS);
        this.dProgress = 0;
        var len = files.length + 1;
        for (var i = 0; i < files.length; i++) {
            const x = files[i];
            this.dProgress = ((i / parseFloat(len.toString())) * 100)
            var path = this.tempPath + "/" + x.path;
            if (overrideFiles.find(f => x.path.indexOf(f) != -1) && await this.RNFS.exists(path))
                await this.RNFS.unlink(path);
            if (x.path.indexOf(".") != -1)
                await validateDir(path, this.RNFS);
            if (!await this.RNFS.exists(path))
                await this.RNFS.writeFile(path, x.content, "utf8");
            if (this.destinationFolderPath) {
                EpubBuilder.onProgress?.(this.dProgress, targetPath, "SaveFile")
                if (this.onSaveProgress)
                    await this.onSaveProgress?.(this.dProgress, targetPath, "SaveFile");
            }
        }
    }

    /*
    epubPath: path to the epub file
    RNFS: file reader settings best use with react-native-fs eg import * as RNFS from 'react-native-fs', or you could use your own filereder
    */
    static async loadEpub(epubPath: string, RNFS: FsSettings, localOnProgress?: (progress: number, file: string) => void) {
        return await EpubLoader(epubPath, RNFS, localOnProgress)
    }
}
