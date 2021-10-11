# react-native-epub-creator

## Installation

```sh
npm install react-native-epub-creator
```

```sh
// this is importend as the autolink would not work
// if you dose not install this manyally
npm install react-native-zip-archive
```

```sh
// the library best work with react-native-fs 
// but you could use any other library instead.
npm install react-native-fs
```
### IOS

```sh
pod install
```

### ANDROID

```sh
nothing to do
```

## Usage

### Create and Epub
```js
import EpubBuilder, { FsSettings, ReadDirItem, EpubChapter, EpubSettings, EpubLoader, getValidFileNameByTitle } from 'react-native-epub-creator';
// the library best work with react-native-fs but you could use your own library instead
import * as RNFS from 'react-native-fs';
   const [progress, setProgress] = React.useState(0)
   EpubBuilder.onProgress = (progress, file)=> {
      setProgress(progress)
    }
     var epub = new EpubBuilder({
      title: "example",
      fileName: getValidFileNameByTitle("examplefile-%1"), // optional, it will take title if not set
      language: "en",
      description: "this is a epub test",
      stylesheet: {
        p: {
          width: "100%"
        }
      },
      chapters: [{
        title: "Air born",
        htmlBody: "<p>this is chapter 1</p>"
      }, {
        title: "chapter 2",
        htmlBody: "<p>this is chapter 2</p>"
      }]
    }, RNFS.DownloadDirectoryPath, RNFS);
    try{     
      // save and create the .epub file
      var epubFilePath = await epub.save();
    }catch(error){
     // remove the temp created folder
     await epub.discardChanges();
    }
```

### Read an Existing Epub file
```js
  var path = RNFS.DownloadDirectoryPath +"/example.epub";
  var localProgress=(progress, file)=> {

  })
  var epub = await EpubLoader(path, RNFS, localProgress);
  // you could add new chapters 
  epub.addChapter({
        fileName: getValidFileNameByTitle("examplefile-%1Chapter1"), // optional, it will take title if not set
        title: "chapter 3",
        htmlBody: "<p>this is chapter 3</p>"
      });
    try{
      // save and create the .epub file
      var epubFilePath = await epub.save();
    }catch(error){
     // remove the temp created folder
     await epub.discardChanges();
    }
 
```

### Create your own File handler
if you would like to use your own file handler you could just implement `FsSettings` interface
```ja
const downloadFileModule = NativeModules.DownloadFileModule;
class Reader implements FsSettings {
    async mkdir(filePath: string) {
        await downloadFileModule.makeDir(filePath);
    }

    async writeFile(filepath: string, content: string, encodingOrOptions?: any) {
        await downloadFileModule.write(content, null, null, filepath, false);
    }

    async unlink(filePath: string) {
        await downloadFileModule.deleteFile(filePath, true);
    }

    async exists(filePath: string) {
        return (await downloadFileModule.exists(filePath)) as boolean;
    }

    async readFile(filePath: string, encodingOrOptions?: any) {
        return await downloadFileModule.getFileContent(filePath)
    }

    async readDir(filePath: string) {
        try {
            var str = (await downloadFileModule.getDirInfo(filePath)) as string;
            var infos = JSON.parse(str) as { path: string, isDirectory: boolean }[];
            return infos.map(x => {
                return {
                    path: x.path,
                    isDirectory: () => x.isDirectory,
                    isFile: () => !x.isDirectory
                } as ReadDirItem
            });
        } catch (error) {
            console.log(error);
            return [] as ReadDirItem[];
        }
    }

}

const RNFS = new Reader();
```

## License

MIT
