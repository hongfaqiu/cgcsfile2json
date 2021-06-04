import { open } from 'shapefile'
import axios from 'axios'
import Qs from 'qs'
export default class File2Coor {
  constructor() {
    // this.coordinates = ['大地2000 有带号直角坐标系', '大地2000 无带号直角坐标系', '大地2000经纬度坐标系'];
    this.wikid = [4528, 4549, 4490];
    this._boundary = { // 杭州范围
      xMin: 118.1217,
      xMax: 120.7753,
      yMin: 29.1304,
      yMax: 30.6191
    }
  }

  getCoordinates() {
    return this.wikid;
  }

  setBoundary(bound) {
    this._boundary = bound;
  }

  async convertFile(file, type, coor = this.wikid[0]) {
    let data = [];
    if(type === 'shp'){
      let temp = await this.parsingShape(file);
      data = await this.handleDataChange(temp, coor);
    } else if(type === 'txt'){
      data = await this.parsingTxt(file);
      if (coor !== this._coordinates[0]) {
        data = await this.handleDataChange(data, coor);
      }
    }
    return data;
  }

  // 通过文件和后缀名判断属于哪个坐标系
  async judgeTypeByName(file, type) {
    if (type === 'txt') { //txt默认为第一种坐标系
      return this._coordinates[0];
    }

    if(type === 'shp'){
      let temp = await this.parsingShape(file);
      for (let coor of this._coordinates) {
        let data = this.handleDataChange(temp, coor);
        if(this.boundCheck(data)){
          return coor;
        }
      }
    }
    return '';
  }

  // 通过文件名判断属于哪个坐标系
  async judgeTypeByName(file, type) {
    if (type === 'txt') { //txt默认为第一种坐标系
      return this.wikid[0];
    }

    if(type === 'shp'){
      let temp = await this.parsingShape(file);
      let firstLon = temp[0].geometry.coordinates[0][0][0]
      for (let type of this.wikid) {
        let data = await this.handleDataChange(temp, type, false);
        if(this.boundCheck(data)){
          return type;
        }
      }
    }
    return '';
  }
  // shape文件解析
  async parsingShape(file) {
    const reader = new FileReader()
    const fileData = file.raw
    let data = [];
    return new Promise((resolve, reject) => {
      reader.readAsArrayBuffer(fileData)
      reader.onload = function (e) {
        open(this.result)
          .then(source => source.read()
            .then(function log(result) {
              if (result.done) return;
              data.push(result.value);
              return source.read().then(log);
            })
            .then(() => resolve(data))
          )
          .catch(error => reject(error.stack));
      }
    })
  }
  // txt文件解析
  parsingTxt(file) {
    let that = this;
    const reader = new FileReader()
    let text = '';
    return new Promise((resolve, reject) => {
      reader.onload = function (e) {
        text = reader.result;
        let arr = text.split('\n');
        resolve(that.getPloygon(arr));
      }
      reader.readAsText(file.raw, 'gb2312');
    })
  }
  // 字符串解析
  getPloygon(arr) {
    let index = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].indexOf("@") !== -1) { //找到坐标开始的行数
        index = i;
        console.log("初始索引", index)
        break;
      }
    }
    let feature = this.readAsCoor(arr, index, { geometry: { coordinates: [] } });
    feature.geometry.coordinates.length > 1 ? feature.type = "MultiPolygon" : feature.type = "Polygon";
    console.log("解析txt得到的坐标", feature)
    return [feature];
  }
  readAsCoor(arr,index, feature){ // 原数据, 地址开始的描述行, 图形对象
    if(index >= arr.length){
      return feature;
    }
    let name = '未知地区';
    if(arr[index].indexOf('@') !== -1){
      name = arr[index++].split(',')[3]; // 获取多边形名称,并将指针往下移到坐标开始行
    }
    feature.name = name;
    let result = [];
    while(arr[index] && arr[index].indexOf('@') === -1){
      let item = arr[index++].split(',');
      let start = 2; 
      for(let i=0 ; i < item.length; i++){
        if(item[i].length > 6){ // 找到直角坐标系数值所在的位置
          start = i;
          break;
        }
      }
      result.push([+item[start],+item[start+1]]);
    }
    feature.geometry.coordinates.push(this.handleCoordinateChange(result));
    if(arr[index] && arr[index].indexOf('@') !== -1){
      return this.readAsCoor(arr, index, feature);
    }
    return feature;
  }
  // 矢量图形坐标转换
  async handleDataChange(arr, type, precise = true) {
    let result = [];
    let that = this;
    console.log("原始数据", arr);
    for (let item of arr) {
      let feature = {
        type: 'feature',
        geometry: {
          coordinates: [],
          type: item.geometry.type
        }
      }

      let coordinates = [];

      item.geometry.coordinates.forEach(coor => { // 处理多面的情况
        if (item.geometry.type === "MultiPolygon" || coor[0][0][0]) { //多多边形的数组深度+1
          coordinates = coordinates.concat(coor);
        } else {
          coordinates.push(coor);
        }
      });

      let res = {
        status: 500
      };
      if (type === that.coordinates[2]) {
        feature.geometry.coordinates = coordinates; // shp文件中的坐标
      } else if (type === that.coordinates[1]) {
        if (precise) {
          res = await this.projectCoor(this.wikid[1], this.wikid[2], coordinates)
        }
        if (precise || res.status === 200) {
          feature.geometry.coordinates = res.data.geometries[0].rings;
        } else {
          for (let i = 0; i < coordinates.length; i++) {
            let coor = coordinates[i];
            feature.geometry.coordinates[i] = this.handleCoordinateChange(coor.map(item => {
              return [item[1], '40' + item[0]]
            })); // shp文件中的坐标xy颠倒,不带带号
          }
        }
      } else if (type === that.coordinates[0]) {
        if (precise) {
          res = await this.projectCoor(this.wikid[0], this.wikid[2], coordinates)
        }
        if (precise || res.status === 200) {
          feature.geometry.coordinates = res.data.geometries[0].rings;
        } else {
          for (let i = 0; i < coordinates.length; i++) {
            let coor = coordinates[i];
            feature.geometry.coordinates[i] = this.handleCoordinateChange(coor.map(item => {
              return [item[1], item[0]]
            })); // shp文件中的坐标xy颠倒,带带号
          }
        }
      }
      result.push(feature);
    }
    console.log("初始坐标", arr);
    console.log("转换后的坐标", result);
    return result;
  }
  // 调用arcgis服务
  projectCoor(inSr, outSr, coordinates) {
    if (inSr === outSr) {
      return { geometries: [{rings: coordinates}] };
    }
    let params = {
      inSR: JSON.stringify({ "wkid": inSr }),
      outSR: JSON.stringify({ "wkid": outSr }),
      geometries: JSON.stringify({
        geometryType: "esriGeometryPolygon",
        geometries: [{rings: coordinates}],
      }),
      transformForward: true,
      f: 'pjson'
    }
    let url="https://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/Geometry/GeometryServer/project";
    let data = Qs.stringify(params);
    return axios.post(url, data ,{headers:{'Content-Type':'application/x-www-form-urlencoded'}})
  }
  // 坐标串批量转换
  handleCoordinateChange(arr) {
    // 解析得到的[3342950.6691,40522253.5211] 应先转换为 [3342950.6691,522253.5211, 40*3] // 文本txt坐标
    // 解析得到的[42528933.72986231, 8319008.05498061] 应先转换为 [8319008.05498061,2528933.72986231, 120] //shp坐标
    let result = [];
    let that = this;
    for (let xy of arr) {
      let X = xy[0];
      let Y = xy[1] - 40000000; //偏移量
      // let L0 = +xy[1].toString().slice(0,2) * 3; // 因为有些坐标带号第二位还有数值,所以不能舍去前两位了
      let L0 = 120;
      let bl = that.xy2lonlat(X, Y, L0);
      result.push(bl);
    }
    return result;
  }
  // cscs2000坐标系平面直角坐标系(XYZ)转大地坐标(BLH)
  // 常规的转换应先确定转换参数，即椭球参数、分带标准（3度，6度）和中央子午线的经度。
  // 对于中央子午线的确定有两种方法，一是取平面直角坐标系中Y坐标的前两位*3，即可得到对应的中央子午线的经度。
  xy2lonlat(X, Y, L0) { // X,Y坐标和中央经线L0
    let lat, lon;
    Y -= 500000;
    let result = [];
    let iPI = 0.0174532925199433; //pi/180
    let a = 6378137.0; //长半轴 m
    let b = 6356752.314140356; //短半轴 m
    let f = 1 / 298.257222101; //扁率 a-b/a
    let e = 0.0818191910428; //第一偏心率 Math.sqrt(5)
    let ee = Math.sqrt(a * a - b * b) / b; //第二偏心率
    let bf = 0; //底点纬度
    let a0 = 1 + (3 * e * e / 4) + (45 * e ** 4 / 64) + (175 * e **6 / 256) + (11025 * e ** 6 / 16384) + (43659 * e ** 8/ 65536);
    let b0 = X / (a * (1 - e * e) * a0);
    let c1 = 3 * e * e / 8 + 3 * e ** 4 / 16 + 213 * e ** 6 / 2048 + 255 * e ** 6 / 4096;
    let c2 = 21 * e ** 4 / 256 + 21 * e ** 6 / 256 + 533 * e ** 6 / 8192;
    let c3 = 151 * e ** 6 / 6144 + 151 * e ** 6 / 4096;
    let c4 = 1097 * e ** 6 / 131072;
    bf = b0 + c1 * Math.sin(2 * b0) + c2 * Math.sin(4 * b0) + c3 * Math.sin(6 * b0) + c4 * Math.sin(8 * b0); // bf =b0+c1*sin2b0 + c2*sin4b0 + c3*sin6b0 +c4*sin8b0 +...
    let tf = Math.tan(bf);
    let n2 = ee * ee * Math.cos(bf) * Math.cos(bf); //第二偏心率平方成bf余弦平方
    let c = a * a / b;
    let v = Math.sqrt(1 + ee * ee * Math.cos(bf) * Math.cos(bf));
    let mf = c / (v * v * v); //子午圈半径
    let nf = c / v; //卯酉圈半径

    //纬度计算
    lat = bf - (tf / (2 * mf) * Y) * (Y / nf) * (1 - 1 / 12 * (5 + 3 * tf * tf + n2 - 9 * n2 * tf * tf) * (Y * Y / (nf * nf)) + 1 / 360 * (61 + 90 * tf * tf + 45 * tf ** 4) * (Y ** 4 / (nf ** 4)));
    //经度偏差
    lon = 1 / (nf * Math.cos(bf)) * Y - (1 / (6 * nf ** 3 * Math.cos(bf))) * (1 + 2 * tf * tf + n2) * Y ** 3+ (1 / (120 * nf ** 5 * Math.cos(bf))) * (5 + 28 * tf * tf + 24 * tf ** 4) * Y ** 4 * Y;
    result[1] = (lat / iPI + 0.0000043).toFixed(7); //纬度
    result[0] = (L0 + lon / iPI).toFixed(7); //经度
    return result;
  }

  boundCheck(data, order = false) { // 转换后的坐标范围校验, order默认为lonlat(经度，纬度)
    for (let i = 0; i < data.length; i++){
      let geo = data[i];
      if (!geo.geometry.coordinates.length) {
        return false;
      }
      for (let j = 0; j < geo.geometry.coordinates.length; j++){
        let rings = geo.geometry.coordinates[j];
        for (let k = 0; k < rings.length; k++){
          if (!this.checkPoint(rings[k], order)) {
            console.log("错误的坐标", rings[k]);
            return false;
          }
        }
      }
    }
    return true;
  }
  checkPoint(point, order) { // 测试经纬度是否在杭州范围内
    let lon = +point[order ? 1 : 0]; // 经度
    let lat = +point[order ? 0 : 1]; // 纬度
    const { xMin, xMax, yMin, yMax } = this._boundary;
    return yMin <= lat && lat <= yMax && xMin <= lon && xMax;
  }
}