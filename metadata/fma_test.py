import os

import IPython.display as ipd
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import sklearn as skl
import librosa
import librosa.display
import utils
from pathlib import Path 
print(utils.__file__)

plt.rcParams['figure.figsize'] = (17, 5)

# Directory where mp3 are stored.

# Load metadata and features.

DATA_DIR = Path(__file__).resolve().parent.parent / 'data' / 'fma_metadata'

tracks = utils.load(DATA_DIR / 'tracks.csv')
genres = utils.load(DATA_DIR / 'genres.csv')
features = utils.load(DATA_DIR / 'features.csv')
echonest = utils.load(DATA_DIR / 'echonest.csv')

np.testing.assert_array_equal(features.index, tracks.index)
assert echonest.index.isin(tracks.index).all()

print("tracks:", tracks.shape)
print("genres:", genres.shape)
print("features:", features.shape)
print("echonest:", echonest.shape)

ipd.display(tracks['track'].head())
ipd.display(tracks['album'].head())
ipd.display(tracks['artist'].head())
ipd.display(tracks['set'].head())

