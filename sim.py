
class Sim(object):

    def __init__(self,inputfile):
        f = open(inputfile,'r')
        alllines = f.readlines()

        self.parameters = {}
        f.close()

        for each in alllines:
            temp = each[:each.find('#')].split()  # Any comments or lines after '#' will be removed. 
            if temp != []:
                if len(temp) == 2:
                    para = temp[1]
                else:
                    para = temp[1:]
                self.parameters[temp[0]] = para

        self.type = self.parameters['type']
        self.dim = [float(each) for each in self.parameters['dim']]
        self.p0 = [float(each) for each in self.parameters['p0']]
        self.theta0 = float(self.parameters['theta0'])
        self.times = int(self.parameters['times'])
        self.display = bool(self.parameters['display'])
        self.log = bool(self.parameters['log'])
        self.filename = self.parameters['filename']
        
if __name__ == '__main__':
    reverb = Sim("reverb_chaos.sim")
    print(reverb.parameters)
    print(reverb.type)
    print(reverb.dim)
    print(reverb.p0)
    print(reverb.theta0)
    print(reverb.times)
    print(reverb.display)
    print(reverb.log)
    print(reverb.filaname)
