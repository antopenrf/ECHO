import os
from platform import system as os_type

import matplotlib.pyplot as plt
import numpy as np


class anaTraces(object):

    def __init__(self, inputfile, open_result=False):
        with open(inputfile, 'r') as lines:
            raw_data = [each.split() for each in lines]
        self.coordinates = [(float(each[0]), float(each[1])) for each in raw_data[2:]]
        self.noc = len(self.coordinates)
        self.basename = inputfile[:inputfile.rfind(".")] if "." in inputfile else inputfile
        self.getSections()
        self.getHistogram()
        self.getSpectrum()
        self.plotHistogram(self.basename + '.png', open_result=open_result)
        self.plotSpectrum(self.basename + '_spectrum.png', open_result=open_result)
        self.saveSpectrum(self.basename + '_spectrum.txt')

    def getSections(self):
        self.raw_sections = []
        for each in range(1, self.noc):
            coor1 = self.coordinates[each]
            coor2 = self.coordinates[each - 1]
            x1 = coor1[0]
            y1 = coor1[1]
            x2 = coor2[0]
            y2 = coor2[1]
            section = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5
            self.raw_sections.append(section)
        self.sections = sorted(int(each * 1e5) / 1e5 for each in self.raw_sections)

    def getHistogram(self):
        self.histogram = {}
        previous = None
        for each in self.sections:
            if each != previous:
                previous = each
                self.histogram[each] = 1
            else:
                self.histogram[each] += 1

    def getSpectrum(self):
        if len(self.raw_sections) < 2:
            self.spectrum_frequency = np.array([])
            self.spectrum_power = np.array([])
            return
        series = np.asarray(self.raw_sections, dtype=float)
        detrended = series - np.mean(series)
        fft = np.fft.rfft(detrended)
        power = np.abs(fft) ** 2 / len(detrended)
        frequency = np.fft.rfftfreq(len(detrended), d=1.0)
        self.spectrum_frequency = frequency[1:]
        self.spectrum_power = power[1:]

    def plotHistogram(self, filename, nofbins=200, open_result=False):
        fig = plt.figure()
        ax = fig.add_subplot(1, 1, 1)
        ax.hist(self.sections, nofbins, density=True, facecolor='green', alpha=0.75)
        ax.set_title('Bounce Length Histogram')
        ax.set_ylabel('Probability')
        ax.set_xlabel('Intersection Length')
        plt.savefig(filename)
        plt.close(fig)
        self._open_file(filename, open_result)

    def plotSpectrum(self, filename, open_result=False):
        if len(self.spectrum_frequency) == 0:
            return
        fig = plt.figure()
        ax = fig.add_subplot(1, 1, 1)
        ax.plot(self.spectrum_frequency, self.spectrum_power, color='darkred', linewidth=1.2)
        ax.set_title('Bounce Length Spectrum')
        ax.set_ylabel('Power')
        ax.set_xlabel('Normalized Frequency')
        ax.grid(True, alpha=0.25)
        plt.savefig(filename)
        plt.close(fig)
        self._open_file(filename, open_result)

    def saveSpectrum(self, filename):
        if len(self.spectrum_frequency) == 0:
            return
        with open(filename, 'w') as handle:
            handle.write("frequency\tpower\n")
            for frequency, power in zip(self.spectrum_frequency, self.spectrum_power):
                handle.write("{0}\t{1}\n".format(frequency, power))

    def _open_file(self, filename, open_result):
        if not open_result:
            return
        if os_type().lower() == "cygwin":
            command = "cygstart"
        elif os_type().lower() == "linux":
            command = "eog"
        else:
            command = "open"
        os.system(command + " " + filename + " &")


if __name__ == '__main__':
    import sys
    if len(sys.argv) == 2:
        filename = sys.argv[1]
        print("\n> Analyze the given data: {0}\n".format(filename))
        ana = anaTraces(filename)
        print("> Saved histogram to: {0}.png".format(ana.basename))
        print("> Saved spectrum plot to: {0}_spectrum.png".format(ana.basename))
        print("> Saved spectrum data to: {0}_spectrum.txt".format(ana.basename))

    elif len(sys.argv) == 1:
        print("\n> No input file given.  Analyze the demo data.\n")
        ana = anaTraces("results_demo_chaos.txt")
        print("> Saved histogram to: {0}.png".format(ana.basename))
        print("> Saved spectrum plot to: {0}_spectrum.png".format(ana.basename))
        print("> Saved spectrum data to: {0}_spectrum.txt".format(ana.basename))
    else:
        print("\nInput syntax error!")
        print("\nRunning simulation file:")
        print("  >python analysis.py filename.txt\n")
        print("\nRunning demo mode:")
        print("  >python sim.py ## no input file\n")
