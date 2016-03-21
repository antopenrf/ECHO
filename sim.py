from reverb import Reverb

import re
from turtle import *

class Sim(object):

    def __init__(self,inputfile):
        f = open(inputfile,'r')
        alllines = f.readlines()

        self.parameters = {}
        f.close()

        for each in alllines:
            temp = each[:each.find('#')].replace(",", " ").split()
            # Any comments or lines after '#' will be removed. 

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

    def _draw_boundary(self):
        bw = self.dim[0]
        radius = self.dim[1]
        particle = Turtle()
        particle.color('blue', 'red')
        particle.speed(10)
        particle.penup()
        if self.type == 'rectangular':
            particle.goto(-bw/2, -radius)
            particle.pendown()
            particle.goto(bw/2, -radius)
            particle.goto(bw/2, radius)
            particle.goto(-bw/2, radius)
            particle.goto(-bw/2, -radius)

        elif self.type == 'chaos':
            particle.goto(-bw/2, -radius)
            particle.pendown()
            particle.goto(bw/2, -radius)
            particle.circle(radius, 180)
            particle.goto(-bw/2, radius)
            particle.penup()
            particle.goto(-bw/2, -radius)
            particle.pendown()
            particle.circle(-radius, 180)

        particle.penup()
        particle.goto(self.p0[0], self.p0[1])
        particle.shape('circle')       
        particle.pendown()
        self.particle = particle

        
    def run(self):
        self._draw_boundary()
        p0 = (self.p0[0], self.p0[1])
        dim = (self.dim[0], self.dim[1])
        rc = Reverb(p0, self.theta0, dim, self.type)
        times = self.times
        trace = rc.bounce(times)
        for each in range(times):
            next(trace)
            self.particle.goto(rc.p[0], rc.p[1])

        input()
        
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
    print(reverb.filename)
    reverb.run()
