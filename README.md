# react-native-epub-creator

## Installation

```sh
npm install react-native-epub-creator
```

```sh
// the library best work with react-native-fs but you could use your own library instead.
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

// ...
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
    
   var epubFilePath = await epub.save(RNFS.DownloadDirectoryPath, RNFS);
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
  var epubFilePath = await epub.save(RNFS.DownloadDirectoryPath, RNFS);
```

## License

MIT
