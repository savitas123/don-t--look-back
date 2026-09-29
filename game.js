/* DON'T LOOK BACK — atmosphere + doll + sound pass. */
const $=id=>document.getElementById(id);
const startScreen=$('startScreen'),gameScreen=$('gameScreen'),birthdayScreen=$('birthdayScreen');
const startButton=$('startButton'),gameCanvas=$('gameCanvas'),messageBox=$('messageBox'),objective=$('objective');
const joystick=$('joystick'),knob=$('joystickKnob'),interactBtn=$('interactButton'),flashBtn=$('flashButton'),mapCanvas=$('mapCanvas'),cinematicFade=$('cinematicFade');

let scene,camera,renderer,clock,world,flashlight,flashTarget;
let doors=[],colliders=[],doll=null,monster=null,lights=[],started=false,elapsed=0,flashOn=true,nearby=null,noticeBoard=null,noticeRead=false,noticeOpen=false,boardDollGone=false;
let firstClassroomEntered=false,firstDollAt=0,scareStage=0,lastStep=0,storyShown=false;
let ambientClinkCount=0,nextAmbientClink=9,ambientClinkMin=5,dollBlackout=false,lastNearbyType='';
let firstDollClink=false, corridorDollClink=false, preFinalClink=false, corridorDollSeen=false;
let finalSequence=false,finalSeqTime=0,finalDoor=null,cinematicSaved={pos:new THREE.Vector3(),yaw:0,pitch:0};
let finalCams={a:new THREE.Vector3(),b:new THREE.Vector3(),c:new THREE.Vector3()};
let flickerLight=null,roomHum=null,tensionAudio=null;
let firstLookTime=0,lookedAwayTime=0,secondDollMoved=false,thirdDollShown=false,creatureShown=false;
const input={x:0,y:0};
const player={pos:new THREE.Vector3(0,1.62,11),yaw:0,pitch:-.06,speed:3.85,radius:.34};

const mats={
  plaster:new THREE.MeshStandardMaterial({color:0x3b3a36,roughness:.94}),
  plasterDark:new THREE.MeshStandardMaterial({color:0x242421,roughness:1}),
  wood:new THREE.MeshStandardMaterial({color:0x33261f,roughness:.9}),
  woodDark:new THREE.MeshStandardMaterial({color:0x16110e,roughness:1}),
  floor:new THREE.MeshStandardMaterial({color:0x252320,roughness:.93}),
  metal:new THREE.MeshStandardMaterial({color:0x55544e,roughness:.72,metalness:.25}),
  paper:new THREE.MeshStandardMaterial({color:0x817967,roughness:1}),
  chalk:new THREE.MeshStandardMaterial({color:0x4d4d48,roughness:1}),
  glass:new THREE.MeshStandardMaterial({color:0x121a1d,roughness:.35,transparent:true,opacity:.3}),
  cloth:new THREE.MeshStandardMaterial({color:0x0c0c0d,roughness:1}),
  skin:new THREE.MeshStandardMaterial({color:0xc5b9a8,roughness:1}),
  hair:new THREE.MeshStandardMaterial({color:0x090909,roughness:1}),
  black:new THREE.MeshStandardMaterial({color:0x050505,roughness:1}),
  bone:new THREE.MeshStandardMaterial({color:0xb7b1a2,roughness:1})
};

function meshBox(w,h,d,mat,x,y,z,rot=0,parent=world){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function addCollider(x1,x2,z1,z2,doorRef=null){colliders.push({x1,x2,z1,z2,doorRef});}
function light(x,y,z,int=.18,dist=7){
  const l=new THREE.PointLight(0xffdfb4,int,dist,.9);l.position.set(x,y,z);l.castShadow=true;l.shadow.mapSize.width=256;l.shadow.mapSize.height=256;scene.add(l);lights.push(l);return l;
}
function wall(w,h,d,x,y,z,mat=mats.plaster,rot=0,collide=true){
  meshBox(w,h,d,mat,x,y,z,rot);if(collide&&!rot)addCollider(x-w/2,x+w/2,z-d/2,z+d/2);
}
function floor(w,d,x,z){meshBox(w,.12,d,mats.floor,x,0,z);}

function textTexture(text,options={}){
  const c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=options.bg||'rgba(0,0,0,0)';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle=options.color||'#6e6a60';ctx.font=(options.font||'32px Georgia');ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.globalAlpha=options.alpha||.65;ctx.fillText(text,c.width/2,c.height/2);return new THREE.CanvasTexture(c);
}

function makeDoor(x,z,label){
  const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
  meshBox(1.8,3.15,.16,mats.wood,0,1.58,0,0,g);
  meshBox(.14,3.55,.24,mats.woodDark,-.99,1.78,0,0,g);meshBox(.14,3.55,.24,mats.woodDark,.99,1.78,0,0,g);meshBox(2.08,.14,.24,mats.woodDark,0,3.55,0,0,g);
  const labelMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.55,.48),new THREE.MeshBasicMaterial({map:textTexture(label,{font:'24px Arial',color:'#b0aa9d',alpha:.65}),transparent:true,depthWrite:false}));labelMesh.position.set(0,2.85,-.095);g.add(labelMesh);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),mats.metal);knob.position.set(.58,1.5,.13);g.add(knob);
  const d={g,label,open:false,ajar:false};doors.push(d);return d;
}

function addBook(x,z,rot=0){
  const g=new THREE.Group();g.position.set(x,1.12,z);g.rotation.y=rot;world.add(g);
  meshBox(.58,.035,.4,mats.paper,0,0,0,0,g);meshBox(.58,.02,.4,mats.chalk,0,.035,0,0,g);return g;
}
function addChalkWriting(cx,cz){
  const tex=textTexture('TODAY  •  4:17',{font:'34px Georgia',color:'#d0ccc0',alpha:.42});
  const p=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.65),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));p.position.set(cx,2.18,cz+3.54);p.rotation.x=0;p.rotation.y=Math.PI;p.scale.x=1.1;world.add(p);
}
function addClock(x,z){
  const g=new THREE.Group();g.position.set(x,2.95,z);world.add(g);
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.08,32),new THREE.MeshStandardMaterial({color:0x9b9382,roughness:.8}));face.rotation.x=Math.PI/2;g.add(face);
  const handMat=new THREE.MeshBasicMaterial({color:0x151515});
  const h1=new THREE.Mesh(new THREE.BoxGeometry(.035,.36,.02),handMat);h1.position.set(0,.15,.055);g.add(h1);
  const h2=new THREE.Mesh(new THREE.BoxGeometry(.035,.26,.02),handMat);h2.rotation.z=Math.PI/2;h2.position.set(.13,0,.06);g.add(h2);
  return g;
}

function classroom(cx,cz,label){
  const W=8,D=7;
  wall(.25,3.8,D,cx-W/2,1.9,cz);wall(.25,3.8,D,cx+W/2,1.9,cz);
  wall(W,3.8,.25,cx,1.9,cz+D/2);wall(3.1,3.8,.25,cx-2.45,1.9,cz-D/2);wall(3.1,3.8,.25,cx+2.45,1.9,cz-D/2);
  const d=makeDoor(cx,cz-D/2-.03,label);addCollider(cx-.8,cx+.8,cz-D/2-.2,cz-D/2+.2,d);
  meshBox(3.2,1.4,.08,mats.chalk,cx,2.05,cz+D/2+.15);meshBox(2.3,1.05,.08,mats.paper,cx,1.05,cz+D/2+.22);
  for(let r=0;r<2;r++)for(let c=0;c<3;c++){
    const x=cx-2.1+c*2.1,z=cz-.8+r*2;meshBox(1.25,.12,.72,mats.wood,x,1.02,z);
    for(const sx of[-.48,.48])for(const sz of[-.24,.24])meshBox(.07,.95,.07,mats.woodDark,x+sx,.52,z+sz);
    if((r===0&&c===1)||(r===1&&c===2))addBook(x-.08,z-.02,(c-r)*.25);
  }
  // One chair deliberately pulled out; the rest stay orderly.
  meshBox(1.15,1.8,.55,mats.woodDark,cx+2.55,.9,cz+1.65);
  meshBox(.7,.95,.7,mats.wood,cx-.55,.5,cz+2.9,.12);
  meshBox(.7,.08,.7,mats.wood,cx-.55,1.02,cz+2.58,.12);
  meshBox(2.7,1.4,.06,mats.paper,cx-2.55,1.95,cz-D/2+.14);
  for(let i=0;i<2;i++)meshBox(1.65,1.55,.05,mats.glass,cx-2+i*2.05,2.2,cz+D/2-.14);
  if(label==='Classroom 01'){addChalkWriting(cx,cz);addClock(cx-2.1,cz+D/2+.04);}
}

function addFrame(x,y,z,w,h,rot=0){
  meshBox(w,.06,.05,mats.woodDark,x,y-h/2,z,rot);
  meshBox(w,.06,.05,mats.woodDark,x,y+h/2,z,rot);
  meshBox(.06,h,.05,mats.woodDark,x-w/2,y,z,rot);
  meshBox(.06,h,.05,mats.woodDark,x+w/2,y,z,rot);
}
function addBench(x,z,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);
  meshBox(2.8,.12,.52,mats.wood,0,.72,0,0,g);
  for(const sx of[-1.15,1.15]) meshBox(.12,.7,.12,mats.woodDark,sx,.35,0,0,g);
  return g;
}
function addCeilingFixture(x,z,dim=.95){
  meshBox(dim,.06,.25,mats.metal,x,3.62,z);
  const bulb=new THREE.Mesh(new THREE.BoxGeometry(dim*.55,.035,.10),new THREE.MeshBasicMaterial({color:0x8e897b,transparent:true,opacity:.8}));
  bulb.position.set(x,3.56,z);world.add(bulb);
  light(x,3.45,z,.07,5.5);
}
function addWindow(x,z,rot=0){
  const g=new THREE.Group();g.position.set(x,2.15,z);g.rotation.y=rot;world.add(g);
  meshBox(2.45,2.0,.06,mats.glass,0,0,0,0,g);
  meshBox(2.62,.10,.12,mats.woodDark,0,1.05,.04,0,g);meshBox(2.62,.10,.12,mats.woodDark,0,-1.05,.04,0,g);
  meshBox(.10,2.12,.12,mats.woodDark,-1.30,0,.04,0,g);meshBox(.10,2.12,.12,mats.woodDark,1.30,0,.04,0,g);
  meshBox(.07,2.0,.08,mats.woodDark,0,0,.05,0,g);meshBox(2.45,.07,.08,mats.woodDark,0,0,.05,0,g);
}
function addPicture(x,z,rot=0,text='HISTORY'){
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.75,1.15,.08),mats.woodDark);frame.position.set(x,2.05,z);frame.rotation.y=rot;world.add(frame);
  const art=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.85),new THREE.MeshStandardMaterial({color:0x5e5a50,roughness:1}));art.position.set(x,2.05,z-.05*Math.cos(rot));art.rotation.y=rot;world.add(art);
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.0,.18),new THREE.MeshBasicMaterial({map:textTexture(text,{font:'16px Georgia',color:'#c3bba9',alpha:.45}),transparent:true,depthWrite:false}));plaque.position.set(x,1.32,z-.06);plaque.rotation.y=rot;world.add(plaque);
}
function createNoticeBoard(){
  const g=new THREE.Group();g.position.set(0,0,6.15);world.add(g);noticeBoard=g;
  meshBox(5.2,2.65,.16,mats.woodDark,0,1.92,0,0,g);
  meshBox(4.82,2.27,.08,mats.paper,0,1.92,-.10,0,g);
  meshBox(4.96,.10,.12,mats.wood,0,.76,-.15,0,g);
  meshBox(4.96,.10,.12,mats.wood,0,3.08,-.15,0,g);
  meshBox(.10,2.42,.12,mats.wood,-2.48,1.92,-.15,0,g);meshBox(.10,2.42,.12,mats.wood,2.48,1.92,-.15,0,g);
  const title=new THREE.Mesh(new THREE.PlaneGeometry(2.7,.42),new THREE.MeshBasicMaterial({map:textTexture('NOTICE  •  1987',{font:'22px Georgia',color:'#4f4a42',alpha:.72}),transparent:true,depthWrite:false}));
  title.position.set(0,2.73,-.205);title.rotation.y=Math.PI;g.add(title);
  const lines=[
    ['CLOSED UNTIL FURTHER NOTICE',-1.35,2.34,-.18],
    ['CLASSROOM 01',-1.55,1.98,-.20],
    ['INCIDENT REPORT — SEE BACK',-1.15,1.28,-.22]
  ];
  for(const [txt,x,y,z] of lines){const q=new THREE.Mesh(new THREE.PlaneGeometry(2.25,.28),new THREE.MeshBasicMaterial({map:textTexture(txt,{font:'15px Arial',color:'#403c36',alpha:.7}),transparent:true,depthWrite:false}));q.position.set(x,y,z);q.rotation.y=Math.PI;g.add(q);}
  // The first doll is physically seated on the notice-board shelf. It is visible before any interaction.
  if(!doll){doll=makeDoll();}
  doll.position.set(0,.82,5.82);doll.rotation.y=Math.PI;doll.rotation.z=-.035;doll.scale.setScalar(1.38);doll.visible=true;doll.userData.boardFirst=true;
}

function buildSchool(){
  world=new THREE.Group();scene.add(world);floor(40,48,0,-8);createNoticeBoard();
  // Main shell: one long, believable school corridor. The rear wall has a deliberate
  // central opening for the final passage instead of doors floating against a wall.
  wall(40,3.8,.3,0,1.9,-32,mats.plasterDark);wall(.3,3.8,48,-20,1.9,-8);wall(.3,3.8,48,20,1.9,-8);
  // Plaster lower band and timber ceiling beams give the corridor real construction detail.
  meshBox(39.2,.75,.10,mats.woodDark,0,.48,-8);
  for(let z=-30;z<16;z+=4){meshBox(40,.16,.28,mats.woodDark,0,3.58,z);}
  for(let z=-29;z<14;z+=5){addWindow(-19.82,z,Math.PI/2);addWindow(19.82,z,-Math.PI/2);}
  classroom(-13,-22,'Classroom 03');classroom(13,-22,'Classroom 04');classroom(-13,-12,'Classroom 05');classroom(13,-12,'Classroom 06');classroom(-13,-2,'Classroom 07');classroom(13,-2,'Classroom 08');classroom(-13,8,'Classroom 01');classroom(13,8,'Classroom 02');
  // Only classroom doors created by classroom() exist. No decorative fake doors are placed along the main corridor walls.
  for(let z=-27;z<14;z+=5.5){addBench(-14,z);addBench(14,z);}
  for(let z=-27;z<14;z+=5.5){addPicture(-10.4,z+.16,Math.PI/2,z<-10?'FOUNDATION':'HOUSE');addPicture(10.4,z+.16,-Math.PI/2,z<-10?'ARCHIVE':'NOTICE');}
  for(let z=-29;z<14;z+=4) addCeilingFixture(0,z,.95);
  light(-10,3.2,-12,.055,4);light(10,3.2,-12,.055,4);
  light(-13,3.15,8,.075,3.2);flickerLight=light(-13,3.15,4.05,.13,4);
  // Natural corridor termination: a solid old plaster wall. No fake staircase or door-like object.
  meshBox(5.8,3.6,.22,mats.plasterDark,0,1.8,-30.6);
  addPicture(-3.8,-27.2,Math.PI/2,'WEST WING');
  for(let z=-24;z<12;z+=4.8){meshBox(.9,1.1,.8,mats.woodDark,-3.8,.55,z);meshBox(.9,1.1,.8,mats.woodDark,3.8,.55,z);}
  // Final passage is open: no unexplained ARCHIVE/OFFICE doors at the dead end.
  addCollider(-20,-19.2,-32,16);addCollider(19.2,20,-32,16);addCollider(-20,20,-32,-31.2);addCollider(-20,20,13.2,14);
}
function makeDoll(){
  const g=new THREE.Group();
  g.visible=false;
  g.userData.seen=false;
  g.userData.head=null;
  g.userData.headTurned=false;

  // A small seated handmade doll. The silhouette is deliberately readable in a
  // narrow flashlight beam: long dark hair, pale cloth face, black dress,
  // white collar/trim, little hands and shoes.
  const dressMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:.92});
  const clothMat=new THREE.MeshStandardMaterial({color:0xd0c7b8,roughness:1});
  const skinMat=new THREE.MeshStandardMaterial({color:0xc7c0b4,roughness:1});
  const hairMat=new THREE.MeshStandardMaterial({color:0x090909,roughness:.95});
  const shoeMat=new THREE.MeshStandardMaterial({color:0x050505,roughness:.9});

  // Torso and skirt: less cone-like, more like an actual sewn doll dress.
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.16,.20,.34,12),dressMat);
  torso.position.y=.42;g.add(torso);
  const skirt=new THREE.Mesh(new THREE.ConeGeometry(.38,.48,16),dressMat);
  skirt.position.y=.17;g.add(skirt);

  // Pale vertical bib and lace-like collar.
  const bib=new THREE.Mesh(new THREE.BoxGeometry(.15,.27,.025),clothMat);
  bib.position.set(0,.46,-.205);g.add(bib);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.145,.026,6,20),clothMat);
  collar.rotation.x=Math.PI/2;collar.position.set(0,.60,-.01);g.add(collar);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(.305,.018,5,24),clothMat);
  trim.rotation.x=Math.PI/2;trim.position.set(0,.20,0);g.add(trim);

  // Head: slightly too large for the body, like a handmade doll.
  const head=new THREE.Mesh(new THREE.SphereGeometry(.245,20,16),skinMat);
  head.scale.set(.91,1.04,.80);head.position.set(0,.92,0);g.add(head);g.userData.head=head;

  // Large dark glass-like eyes.
  for(const x of[-.087,.087]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.052,14,10),new THREE.MeshStandardMaterial({color:0x050505,roughness:.15,metalness:.05}));
    eye.position.set(x,.965,-.190);g.add(eye);
    const glint=new THREE.Mesh(new THREE.SphereGeometry(.010,8,6),new THREE.MeshBasicMaterial({color:0xaaa49a}));
    glint.position.set(x-.012,.982,-.238);g.add(glint);
  }

  // Stitched mouth: small dark segments rather than a flat texture.
  for(let i=0;i<8;i++){
    const stitch=new THREE.Mesh(new THREE.BoxGeometry(.027,.010,.008),new THREE.MeshBasicMaterial({color:0x171717}));
    const x=-.095+i*.027;
    stitch.position.set(x,.835,-.204);
    stitch.rotation.z=(i%2?-0.55:0.55);
    g.add(stitch);
  }

  // Long uneven hair strips. They frame the face and make the silhouette
  // readable without looking like a black sphere glued to the head.
  for(let i=-7;i<=7;i++){
    const strand=new THREE.Mesh(new THREE.BoxGeometry(.032,.50+(Math.abs(i)%3)*.035,.028),hairMat);
    const x=i*.034;
    strand.position.set(x,.89,.035);
    strand.rotation.z=(i*.018);
    strand.rotation.x=(i%2?-.035:.02);
    g.add(strand);
  }
  for(let side of[-1,1]){
    for(let i=0;i<3;i++){
      const strand=new THREE.Mesh(new THREE.BoxGeometry(.036,.54+i*.04,.035),hairMat);
      strand.position.set(side*(.18+i*.025),.78-i*.01,.01);
      strand.rotation.z=side*(.08+i*.03);
      g.add(strand);
    }
  }

  // Arms resting naturally on the lap.
  for(const side of[-1,1]){
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(.035,.043,.27,9),dressMat);
    upper.position.set(side*.19,.50,-.02);upper.rotation.z=side*.30;g.add(upper);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),skinMat);
    hand.position.set(side*.235,.38,-.10);g.add(hand);
  }

  // Bent legs and old black shoes, clearly seated rather than standing.
  for(const side of[-1,1]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,.30,9),dressMat);
    leg.position.set(side*.10,.03,-.13);leg.rotation.x=-Math.PI/2.35;g.add(leg);
    const shoe=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),shoeMat);
    shoe.scale.set(.80,.52,1.35);shoe.position.set(side*.105,-.055,-.31);g.add(shoe);
  }

  // Slightly imperfect posture.
  g.rotation.z=-.025;
  g.scale.setScalar(1.22);
  world.add(g);
  return g;
}
function makeMonster(){
  const g=new THREE.Group();g.visible=false;g.userData.moved=false;
  const coatMat=new THREE.MeshStandardMaterial({color:0x080808,roughness:1});
  const clothMat=new THREE.MeshStandardMaterial({color:0x141312,roughness:.96});
  const faceMat=new THREE.MeshStandardMaterial({color:0xaaa397,roughness:1});
  const voidMat=new THREE.MeshStandardMaterial({color:0x010101,roughness:1});
  const faceGlow=new THREE.MeshBasicMaterial({color:0xf0dfbd});
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.58,1.55,.34),coatMat);torso.position.y=2.05;g.add(torso);
  const coatSkirt=new THREE.Mesh(new THREE.CylinderGeometry(.43,.72,1.45,10),clothMat);coatSkirt.position.y=1.15;g.add(coatSkirt);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(.92,.28,.40),coatMat);shoulder.position.y=2.67;g.add(shoulder);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,.34,9),coatMat);neck.position.y=2.96;g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.30,16,12),faceMat);head.scale.set(.70,1.28,.72);head.position.set(0,3.34,0);head.rotation.z=-.18;g.add(head);
  const faceVoid=new THREE.Mesh(new THREE.PlaneGeometry(.38,.54),voidMat);faceVoid.position.set(0,3.31,-.218);faceVoid.rotation.y=Math.PI;faceVoid.rotation.z=-.18;g.add(faceVoid);
  // Jester-like asymmetry: the eyes sit at deliberately different heights and widths.
  const eyeMat=new THREE.MeshBasicMaterial({color:0xe6dcc8});
  const eyeL=new THREE.Mesh(new THREE.SphereGeometry(.032,8,6),eyeMat);eyeL.position.set(-.075,3.42,-.245);eyeL.scale.set(1.0,.72,.65);g.add(eyeL);
  const eyeR=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),eyeMat);eyeR.position.set(.095,3.30,-.245);eyeR.scale.set(.72,1.35,.65);g.add(eyeR);eyeL.visible=false;eyeR.visible=false;
  // One enormous, crooked illuminated smile is the only bright feature of the creature.
  const mouth=new THREE.Mesh(new THREE.CircleGeometry(.155,24),voidMat);mouth.scale.set(1.65,.55,1);mouth.position.set(0,3.08,-.246);mouth.rotation.y=Math.PI;mouth.rotation.z=-.18;g.add(mouth);
  const smileCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.22,3.11,-.265),new THREE.Vector3(-.11,3.00,-.27),new THREE.Vector3(0,2.98,-.27),
    new THREE.Vector3(.13,3.01,-.27),new THREE.Vector3(.25,3.13,-.265)
  ]);
  const smile=new THREE.Mesh(new THREE.TubeGeometry(smileCurve,20,.026,7,false),faceGlow);smile.visible=false;g.add(smile);
  // Tiny upward hooks make the smile read as unnaturally jester-like without gore.
  const hooks=[];
  for(const sx of[-1,1]){
    const hook=new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(sx*.20,3.10,-.267),new THREE.Vector3(sx*.27,3.19,-.267)),6,.018,6,false),faceGlow);hook.visible=false;g.add(hook);hooks.push(hook);
  }
  for(const ss of[-1,1]){
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,1.20,9),coatMat);upper.position.set(ss*.49,2.03,0);upper.rotation.z=ss*.13;g.add(upper);
    const fore=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,1.15,9),coatMat);fore.position.set(ss*.60,1.12,-.01);fore.rotation.z=ss*.10;g.add(fore);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.095,9,7),faceMat);hand.scale.set(.55,1.25,.55);hand.position.set(ss*.66,.55,-.01);g.add(hand);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.085,.12,1.85,9),coatMat);leg.position.set(ss*.19,.42,0);leg.rotation.z=ss*.015;g.add(leg);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.20,.12,.48),voidMat);shoe.position.set(ss*.19,-.52,-.08);g.add(shoe);
  }
  meshBox(.24,1.55,.08,coatMat,0,1.55,.23,0,g);
  g.userData.eyeL=eyeL;g.userData.eyeR=eyeR;g.userData.smile=smile;g.userData.hooks=hooks
