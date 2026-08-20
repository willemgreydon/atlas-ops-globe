const layers = [
  ["Aircraft / ADS-B","#65f6c7"],["Maritime / AIS","#54c7ff"],["Conflict & unrest","#ff5a62"],["Natural hazards","#ffae45"],["Cyber exposure","#b18cff"],["News & public figures","#f1f4f8"],["Weather / clouds","#9ad7ff"],["Economic indicators","#ffd166"],
];
export default function Layers(){ return <section className="layers"><h3>Operational Layers</h3>{layers.map(([name,color])=><div className="layer-row" key={name}><span><i className="dot" style={{background:color}} />{name}</span><span>●</span></div>)}</section> }
