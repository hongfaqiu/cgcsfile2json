# cgcs2000file2json

convert cgcs2000 polygon shp or txt to geojson

## Usage

```js

import file2coor from 'cgcsfile2json'

let txtFile = getFile('test.txt');
let coors = file2coor.getCoordinates();
// coors: ['大地2000 有带号直角坐标系', '大地2000 无带号直角坐标系', '大地2000经纬度坐标系']
// txt's coordinate defalut is '大地2000 有带号直角坐标系'
let data = file2coor.convertFile(txtFile, 'txt'); 

let shpFile = getFile('test.shp');
let data2 = file2coor.convertFile(shpFile, 'shp', coors[2]); 

```

## API

### ``getCoordinates()``

['大地2000 有带号直角坐标系', '大地2000 无带号直角坐标系', '大地2000经纬度坐标系']

### ``convertFile(file, type, coor = '大地2000 有带号直角坐标系')``

convert .shp or .txt file to geojson 
