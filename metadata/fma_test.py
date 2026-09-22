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
print(utils.__file__)

plt.rcParams['figure.figsize'] = (17, 5)

# Directory where mp3 are stored.
AUDIO_DIR = os.environ.get('AUDIO_DIR')

# Load metadata and features.
tracks = utils.load('metadata/fma_metadata/tracks.csv')
genres = utils.load('metadata/fma_metadata/genres.csv')
features = utils.load('metadata/fma_metadata/features.csv')
echonest = utils.load('metadata/fma_metadata/echonest.csv')

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

