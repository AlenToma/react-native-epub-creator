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
import EpubBuilder from "react-native-epub-creator";
// the library best work with react-native-fs but you could use your own library instead
import * as RNFS from 'react-native-fs';

   EpubBuilder.onProgress = (progress, file)=> {
      setProgress(progress)
    }

     var epub = new EpubBuilder({
      title: "example",
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
    });
    try{
      await epub.prepare(); // this will create a temporary folder that will containe the epub files
    
      var epubFilePath = await epub.save(RNFS.DownloadDirectoryPath, RNFS);
    }catch(error){
     await epub.discardChanges();
    }
```

### Read Existing Epub file
```js
  var path = RNFS.DownloadDirectoryPath +"/example.epub";
  var epub = EpubBuilder.loadEpub(path, RNFS);
  // you could add new chapters 
  epub.addChapter({
        title: "chapter 3",
        htmlBody: "<p>this is chapter 3</p>"
      });
    try{
      var epubFilePath = await epub.save(RNFS.DownloadDirectoryPath, RNFS);
    }catch(error){
     await epub.discardChanges();
    }
 
```

## License

MIT
