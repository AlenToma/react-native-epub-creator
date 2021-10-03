import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import EpubBuilder from '../EpubBuilder';
import { MainBundlePath, DocumentDirectoryPath } from 'react-native-fs'
import * as RNFS from 'react-native-fs';

export default function App() {
  const [path, setPath] = useState("");
  const [progress, setProgress] = useState(0);
  const createFile = async () => {
    EpubBuilder.onProgress = (progress)=> {
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
        htmlBody: "<p>this is chapter 1</p>"
      }]
    });
    var p = await epub.save(RNFS.DownloadDirectoryPath, RNFS);
    setPath(p);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={createFile}>
        <Text>
          create epub {progress}%
          {"\n"}
          {path}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
