
class anaTracks(object):
    
    def __init__(self, inputfile):
        lines = open(inputfile, 'r')
        raw_data = [each.split() for each in lines]
        self.coordinates = [ (float(each[0]), float(each[1])) for each in raw_data[2:] ]
        self.noc = len(self.coordinates)  ## number of coordinates
        self.getSections()

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

if __name__ == '__main__':
    ana = anaTracks("results_chaos.txt")
    print(ana.sections)
            
            
