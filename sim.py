#!/usr/bin/python

from reverb import Reverb

class Sim(object):

    def __init__(self,inputfile):
        self.parameters = {}
        with open(inputfile, 'r') as f:
            alllines = f.readlines()

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
        self.dim = [float(each) for each in self.parameters['dim']] if 'dim' in self.parameters else None
        self.p0 = [float(each) for each in self.parameters['p0']]
        self.theta0 = float(self.parameters['theta0'])
        self.times = int(self.parameters['times'])
        self.display = self._parse_bool(self.parameters['display'])
        self.log = self._parse_bool(self.parameters['log'])
        self.draw = self._parse_bool(self.parameters['draw'])
        self.filename = self.parameters['filename']
        self.shape_file = self.parameters.get('shape_file')

    @staticmethod
    def _parse_bool(value):
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}

    def _draw_boundary(self):
        try:
            from turtle import Turtle, getscreen, setup
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Turtle drawing requires tkinter support in this Python build."
            ) from exc

        particle = Turtle()
        particle.color('blue', 'red')
        setup(width = 1200, height = 800)
        particle.width(2)
        particle.speed(10)
        particle.penup()
        vertices = self.rc.vertices
        particle.goto(vertices[0][0], vertices[0][1])
        particle.pendown()
        for vertex in vertices[1:]:
            particle.goto(vertex[0], vertex[1])
        particle.goto(vertices[0][0], vertices[0][1])

        particle.penup()
        particle.goto(self.p0[0], self.p0[1])
        particle.shape('circle')       
        particle.pendown()
        particle.color('green', 'red')
        particle.width(1)
        self.particle = particle
        
    def run(self):
        p0 = (self.p0[0], self.p0[1])
        dim = (self.dim[0], self.dim[1]) if self.dim is not None else None
        self.rc = Reverb(p0, self.theta0, dim, self.type, shape_file=self.shape_file)
        trace = self.rc.bounce(self.times, self.display, self.log, self.filename)

        if self.draw:
            try:
                self._draw_boundary()
            except RuntimeError as exc:
                print("\nDrawing disabled: {0}\n".format(exc))
                self.draw = False
        
        for each in range(self.times):
            next(trace)
            if self.draw:
                self.particle.goto(self.rc.p[0], self.rc.p[1])
        if self.draw:
            try:
                y = input("\nPress any key to exit!\n")
            except:
                pass
            epsfile = self.filename + ".eps"
            from turtle import getscreen
            ts = getscreen()
            ts.getcanvas().postscript(file = epsfile)



if __name__ == '__main__':
    import sys
    if len(sys.argv) == 2:
        filename = sys.argv[1]
        print("\nRunning simulation file: {0}".format(filename))
        reverb = Sim(filename)
        reverb.run()
    elif len(sys.argv) == 1:
        print("\nNo input file given.  Running demo mode on chaotic reverberation.\n")
        reverb = Sim("input_chaos.sim")
        reverb.run()
    else:
        print("\nInput syntax error!")
        print("\nRunning simulation file:")
        print("  >python sim.py filename.sim\n")
        print("\nRunning demo mode:")
        print("  >python sim.py ## no input file\n")
