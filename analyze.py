import matplotlib.pyplot as plt
from platform import system as os_type
import os

class anaTraces(object):
    
    def __init__(self, inputfile):
        lines = open(inputfile, 'r')
        raw_data = [each.split() for each in lines]
        self.coordinates = [ (float(each[0]), float(each[1])) for each in raw_data[2:] ]
        self.noc = len(self.coordinates)  ## number of coordinates
        self.getSections()
        self.getHistogram()
        self.plotHistogram(inputfile[:inputfile.find(".")] + '.png')

    def getSections(self):
        self.sections = []
        for each in range(1, self.noc):
            coor1 = self.coordinates[each]
            coor2 = self.coordinates[each - 1]
            x1 = coor1[0]
            y1 = coor1[1]
            x2 = coor2[0]
            y2 = coor2[1]
            section = ((x1 - x2)**2 + (y1 - y2)**2)**0.5
            ## round up
            self.sections.append(section)
        self.sections.sort()
        self.sections = [ int(each*1e5)/1e5 for each in self.sections]

    def plotHistogram(self, filename):
        fig = plt.figure()
        ax = fig.add_subplot(1,1,1)
        n, bins, patches = ax.hist(self.sections, 50, normed=1, facecolor='green', alpha=0.75)
        ax.set_title = filename
        ax.set_ylabel = 'Probability'
        ax.set_xlabel = 'Intersection Length'
        #plt.show()
        plt.savefig(filename)
        if os_type().lower() == "cygwin":
            command = "cygstart"
        elif os_type().lower() == "linux":
            command = "eog"
        else:
            command = "open"
        os.system(command + " " + filename + " &")

        
    def getHistogram(self):
        self.histogram = {}
        previous = None
        for each in self.sections:
            if each != previous:
                previous = each
                self.histogram[each] = 1
            else:
                self.histogram[each] += 1
                
if __name__ == '__main__':
    import sys
    if len(sys.argv) == 2:
        filename = sys.argv[1]
        print("\n> Analyze the given data: {0}\n".format(filename))
        ana = anaTraces(filename)                    

    elif len(sys.argv) == 1:
        print("\n> No input file given.  Analyze the demo data.\n")
        ana = anaTraces("results_demo_chaos.txt")
    else:
        print("\nInput syntax error!")
        print("\nRunning simulation file:")
        print("  >python analysis.py filename.txt\n")
        print("\nRunning demo mode:")
        print("  >python sim.py ## no input file\n")

