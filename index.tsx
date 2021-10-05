import { zip, unzip } from 'react-native-zip-archive'
import EpubFile, { EpubSettings, File, EpubChapter } from 'epub-constructor'
import { v4 as uuidv4 } from 'uuid';

export type ReadDirItem = {
    path: string // The absolute path to the item
    isFile: () => boolean // Is the file just a file?
    isDirectory: () => boolean // Is the file a directory?
}

export type {
    File,
    EpubChapter,
    EpubSettings
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

const validateDir = async (path: string, reader: FsSettings) => {
    path = getFolderPath(path);
    if (!(await reader.exists(path))) {
        console.log("creating dir:" + path)
        await reader.mkdir(path);
    }
}

const getFolderPath = (path: string) => {
    var name = path.split("/").reverse()[0];
    if (path.indexOf("/") != -1) {
        if (name.indexOf(".") != -1)
            path = path.split("/").reverse().filter((x, index) => index > 0).reverse().join("/");
    }
    return path;
}


const getFiles = async (folder: string, reader: FsSettings) => {
    var fs = await reader.readDir(folder);
    var files = [] as ReadDirItem[];
    for (var f of fs) {
        if (f.isFile())
            files.push(f);
        else if (f.isDirectory()) {
            (await getFiles(f.path, reader)).forEach(x => {
                files.push(x);
            });
        }
    }
    return files;
}

export default class EpubBuilder {
    private settings: EpubSettings;
    static onProgress?: (progress: number, epubFile: string) => void;
    private destinationFolderPath?: string;
    private tempPath?: string;
    private RNFS: FsSettings;
    private dProgress: number = 0;

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
            if (await this.RNFS.exists(this.tempPath))
                await this.RNFS.unlink(this.tempPath);
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
        const epub = new EpubFile(this.settings);
        const files = epub.constructEpub();
        const targetPath = `${this.destinationFolderPath}/${this.settings.title}.epub`
        var len = files.length + 1;

        await this.createTempFolder();
        try {
            if (await this.RNFS.exists(targetPath))
                await this.RNFS.unlink(targetPath);
        } catch (error) {
            console.log("unable to delete the existing: " + targetPath)
        }
        await zip(this.tempPath, targetPath);
        if (removeTempFile !== false)
             await this.discardChanges();
        this.dProgress = ((len / parseFloat(len.toString())) * 100);
        EpubBuilder.onProgress?.(this.dProgress, this.destinationFolderPath);
        return targetPath;
    }

    private async createTempFolder() {
        var overrideFiles = ["toc.ncx", "toc.html", ".opf"]
        const epub = new EpubFile(this.settings);
        const files = epub.constructEpub();
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
            EpubBuilder.onProgress?.(this.dProgress, this.destinationFolderPath)
        }
    }

    /*
    epubPath: path to the epub file
    RNFS: file reader settings best use with react-native-fs eg import * as RNFS from 'react-native-fs', or you could use your own filereder
    */
    static async loadEpub(epubPath: string, RNFS: FsSettings) {
        if (!await RNFS.exists(epubPath))
            throw "Epub File could not be found.";
        const folder = getFolderPath(epubPath) + "/" + uuidv4();
        await validateDir(folder, RNFS);
        await unzip(epubPath, folder, "UTF-8");
        const epubFiles = [] as File[];
        const files = await getFiles(folder, RNFS);
        const len = files.length + 1;
        var dProgress = 0;
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            dProgress = ((i / parseFloat(len.toString())) * 100)
            if (f.isFile()) {
                var file = {
                    path: f.path.replace(folder, ""),
                    content: await RNFS.readFile(f.path)
                } as File
                epubFiles.push(file);
                EpubBuilder.onProgress?.(dProgress, epubPath);
            }
        }

        await RNFS.unlink(folder);
        dProgress = ((len / parseFloat(len.toString())) * 100)
        EpubBuilder.onProgress?.(dProgress, epubPath);
        return await new EpubBuilder(EpubFile.load(epubFiles), folder, RNFS);
    }
}
