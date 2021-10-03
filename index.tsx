import { zip, unzip } from 'react-native-zip-archive'
import EpubFile, { EpubSettings, File, EpubChapter } from 'epub-constructor'
import { v4 as uuidv4 } from 'uuid';

export type ReadDirItem = {
    path: string // The absolute path to the item
    isFile: () => boolean // Is the file just a file?
    isDirectory: () => boolean // Is the file a directory?
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

class EpubBuilder {
    public settings: EpubSettings;

    static onProgress?: (progress: number, epubFile: string) => void;

    constructor(settings: EpubSettings) {
        this.settings = settings;
    }

    async addChapter(epubChapter: EpubChapter) {
        this.settings.chapters.push(epubChapter);
    }


    /*
    destinationFolderPath: destination to the folder, You could use react-native-fs RNFS.DownloadDirectoryPath
    RNFS: file reader settings best use with react-native-fs eg import * as RNFS from 'react-native-fs', or you could use your own filereder
    */
    public async save(destinationFolderPath: string, RNFS: FsSettings) {
        const epub = new EpubFile(this.settings);
        const files = epub.constructEpub();
        const downloadDirectoryPath = getFolderPath(destinationFolderPath);
        const targetPath = `${downloadDirectoryPath}/${this.settings.title}.epub`
        const temp = downloadDirectoryPath + "/" + uuidv4();
        await validateDir(temp, RNFS);
        var dProgress = 0;
        var len = files.length + 1;
        for (var i = 0; i < files.length; i++) {
            const x = files[i];
            dProgress = ((i / parseFloat(files.length.toString())) * 100)
            var path = temp + "/" + x.path;
            if (x.path.indexOf(".") != -1)
                await validateDir(path, RNFS);
            await RNFS.writeFile(path, x.content, "utf8");
            EpubBuilder.onProgress?.(dProgress, destinationFolderPath)
        }
        try {
            if (await RNFS.exists(targetPath))
                await RNFS.unlink(targetPath);

        } catch (error) {
            console.log("unable to delete the existing: " + targetPath)
        }

        await zip(temp, targetPath);
        await RNFS.unlink(temp);
        dProgress = ((len / parseFloat(len.toString())) * 100);
        EpubBuilder.onProgress?.(dProgress, destinationFolderPath)
        return targetPath;
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
            dProgress = ((i / parseFloat(files.length.toString())) * 100)
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
        return new EpubBuilder(EpubFile.load(epubFiles));
    }
}

export default EpubBuilder;