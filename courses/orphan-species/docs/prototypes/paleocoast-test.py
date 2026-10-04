import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.io import netcdf_file
f=netcdf_file('etopo4.nc','r',mmap=False)
lat=f.variables['latitude'][:].copy(); lon=f.variables['longitude'][:].copy(); z=f.variables['altitude'][:].astype(float)
regions={'Sunda–Sahul (Wallacea)':(90,160,-20,15),'Beringia':(150,215,50,75),'Bab el-Mandeb & Arabia':(30,62,8,32),'Europe':(-12,40,34,62)}
fig,axs=plt.subplots(2,2,figsize=(14,10))
for ax,(name,(x0,x1,y0,y1)) in zip(axs.flat,regions.items()):
    L=lon.copy(); Z=z
    if x1>180:  # wrap
        L=np.where(lon<0,lon+360,lon); o=np.argsort(L); L=L[o]; Z=z[:,o]
    xi=(L>=x0)&(L<=x1); yi=(lat>=y0)&(lat<=y1)
    X,Y=np.meshgrid(L[xi],lat[yi]); S=Z[np.ix_(yi,xi)]
    ax.contourf(X,Y,S,levels=[-120,0],colors=['#d9b98c'])   # exposed at LGM
    ax.contourf(X,Y,S,levels=[0,9000],colors=['#8a6d4b'])   # land today
    ax.contour(X,Y,S,levels=[-120],colors=['#333'],linewidths=0.5)
    ax.set_facecolor('#cfe3ef'); ax.set_title(f'{name}: today (dark) vs −120 m sea level (light)'); ax.set_aspect('equal')
plt.tight_layout(); plt.savefig('paleocoast_test.png',dpi=80)
print('ok')
