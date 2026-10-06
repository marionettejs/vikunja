"""Compare paired fixture captures without masking or claiming pixel parity."""
import sys,json
from pathlib import Path
from PIL import Image,ImageChops,ImageStat,ImageDraw
reference,current,output=map(Path,sys.argv[1:4]);output.mkdir(parents=True,exist_ok=True)
states=tuple(sys.argv[4:]) or ('login','home','directory','list','table','kanban','gantt','task','settings','sharing','modal','editor')
report=[];groups=[]
for width in (1440,390):
 pairs=[]
 for name in states:
  matches=[sorted(root.rglob(f'{name}-{width}.png')) for root in (reference,current)]
  if not all(matches):report.append({'state':name,'width':width,'status':'missing capture'});continue
  images=[Image.open(paths[0]).convert('RGB') for paths in matches]
  if images[0].size!=images[1].size:raise ValueError(f'{name}: mismatched viewport')
  delta=ImageChops.difference(*images)
  report.append({'state':name,'width':width,'status':'captured, visual review required','reference':str(matches[0][0]),'native':str(matches[1][0]),'mean_absolute_rgb_difference':sum(ImageStat.Stat(delta).mean)/3,'different_pixels':delta.width*delta.height-ImageChops.lighter(ImageChops.lighter(delta.getchannel('R'),delta.getchannel('G')),delta.getchannel('B')).histogram()[0]})
  delta.save(output/f'{name}-{width}-difference.png')
  scale=min(1,720/width);w,h=map(lambda n:round(n*scale),images[0].size)
  row=Image.new('RGB',(w*2,h+24),'white');draw=ImageDraw.Draw(row);draw.text((4,4),f'Vue: {name} {width}',fill='black');draw.text((w+4,4),f'RC2: {name} {width}',fill='black')
  for i,img in enumerate(images):row.paste(img.resize((w,h)),(i*w,24))
  pairs.append(row)
 for i in range(0,len(pairs),2):
  rows=pairs[i:i+2];canvas=Image.new('RGB',(rows[0].width,sum(row.height for row in rows)),'white');y=0
  for row in rows:canvas.paste(row,(0,y));y+=row.height
  canvas.save(output/f'comparison-{width}-{i//2+1}.png')
(output/'metrics.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len([r for r in report if "native" in r])} paired captures; differences require review, no pass threshold applied')
