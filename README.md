# cgcsfile2json

convert cgcs2000(4528, 4549, 4490) polygon shp or txt to CGCS_2000(EPSG:4490) geojson
代码写得很烂，凑活用吧，后面有空再重构

## usage

For node.js

    npm install --save cgcsfile2json

## example

```js

import file2coor from 'cgcsfile2json'

let txtFile = getFile('test.txt');
let coors = file2coor.getCoordinates();
// coors: [4528, 4549, 4490];
// coorsCh: ['大地2000 有带号直角坐标系', '大地2000 无带号直角坐标系', '大地2000经纬度坐标系']
// txt's coordinate defalut is '大地2000 有带号直角坐标系'
let data = file2coor.convertFile(txtFile, 'txt'); 

let shpFile = getFile('test.shp');
let data2 = file2coor.convertFile(shpFile, 'shp', coors[2]); 

```

## API

### ``getCoordinates()``

[4528, 4549, 4490]

### ``convertFile(file, type, coor = 4528)``

convert .shp or .txt file to geojson

### ``boundCheck(data, order = false)``

check if the geojson data is out of bounds
when 'order' value is true, representes the point's coordinates is [lat, lon], otherwise defalut is [lon, lat]

### ``setBoundary(bound)``

defalut boundary is:  

```js
{ // 杭州范围
  xMin: 118.1217,
  xMax: 120.7753,
  yMin: 29.1304,
  yMax: 30.6191
}
```

### ``judgeTypeByName(file, type)``

judge the file(shp or txt)'s coordinates, txt file is 4528('大地2000 有带号直角坐标系').

The coordinate system of SHP file will be judged by whether the converted data exceeds the set boundary

### ``parsingShape(file)``

parse the shp file to geojson

```js
parsingShape(file).then(res => {
  console.log(res);
})
```

### ``handleDataChange(data, coor, precise = true)``

convert the data to CGCS_2000(EPSG:4490) geojson
when precise param is false, use the offline algorithm, which can only be accurate to the seven decimal place.
defalut chose the online algorithm provided by [arcgis server](https://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/Geometry/GeometryServer/project).

### ``xy2lonlat(X, Y, L0)``

convert cscs2000(XYZ) point to cscs2000(BLH)
