export enum District {
  Taipei = '臺北市',
  NewTaipei = '新北市',
  Taoyuan = '桃園市',
  Taichung = '臺中市',
  Tainan = '臺南市',
  Kaohsiung = '高雄市',
  Keelung = '基隆市',
  HsinchuCity = '新竹市',
  ChiayiCity = '嘉義市',
  HsinchuCounty = '新竹縣',
  Miaoli = '苗栗縣',
  Changhua = '彰化縣',
  Nantou = '南投縣',
  Yunlin = '雲林縣',
  ChiayiCounty = '嘉義縣',
  Pingtung = '屏東縣',
  Yilan = '宜蘭縣',
  Hualien = '花蓮縣',
  Taitung = '臺東縣',
  Penghu = '澎湖縣',
  Kinmen = '金門縣',
  Lienchiang = '連江縣',
}

export interface PoliceStation {
  district: District;
  stationName: string;
  phoneNumber: string;
}

export const POLICE_STATIONS: readonly PoliceStation[] = [
  { district: District.Taipei, stationName: '臺北市政府警察局', phoneNumber: '0911510914' },
  { district: District.NewTaipei, stationName: '新北市政府警察局', phoneNumber: '0911510105' },
  { district: District.Taoyuan, stationName: '桃園市政府警察局', phoneNumber: '0917110880' },
  { district: District.Taichung, stationName: '臺中市政府警察局', phoneNumber: '0911510915' },
  { district: District.Tainan, stationName: '臺南市政府警察局', phoneNumber: '0911510916' },
  { district: District.Kaohsiung, stationName: '高雄市政府警察局', phoneNumber: '0911510917' },
  { district: District.Keelung, stationName: '基隆市警察局', phoneNumber: '0911510918' },
  { district: District.HsinchuCity, stationName: '新竹市警察局', phoneNumber: '0911510919' },
  { district: District.ChiayiCity, stationName: '嘉義市政府警察局', phoneNumber: '0911510920' },
  { district: District.HsinchuCounty, stationName: '新竹縣政府警察局', phoneNumber: '0911510921' },
  { district: District.Miaoli, stationName: '苗栗縣警察局', phoneNumber: '0911510922' },
  { district: District.Changhua, stationName: '彰化縣警察局', phoneNumber: '0911510933' },
  { district: District.Nantou, stationName: '南投縣政府警察局', phoneNumber: '0911510923' },
  { district: District.Yunlin, stationName: '雲林縣警察局', phoneNumber: '0911510924' },
  { district: District.ChiayiCounty, stationName: '嘉義縣警察局', phoneNumber: '0911510925' },
  { district: District.Pingtung, stationName: '屏東縣政府警察局', phoneNumber: '0911510926' },
  { district: District.Yilan, stationName: '宜蘭縣政府警察局', phoneNumber: '0911510927' },
  { district: District.Hualien, stationName: '花蓮縣警察局', phoneNumber: '0911510928' },
  { district: District.Taitung, stationName: '臺東縣警察局', phoneNumber: '0911510929' },
  { district: District.Penghu, stationName: '澎湖縣政府警察局', phoneNumber: '0911510930' },
  { district: District.Kinmen, stationName: '金門縣警察局', phoneNumber: '0911510931' },
  { district: District.Lienchiang, stationName: '連江縣警察局', phoneNumber: '0911510932' },
];

export function findStationByAddress(address: string): PoliceStation | null {
  const normalized = address.replace(/台/g, '臺');
  return POLICE_STATIONS.find((s) => normalized.includes(s.district)) ?? null;
}
