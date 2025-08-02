import sys
import json
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

def solve_tsp(distance_matrix):
    n = len(distance_matrix)
    data = {}
    data['distance_matrix'] = distance_matrix
    data['num_vehicles'] = 1
    data['depot'] = 0

    manager = pywrapcp.RoutingIndexManager(n, data['num_vehicles'], data['depot'])
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(data['distance_matrix'][from_node][to_node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Não retorna ao ponto inicial!
    for node in range(1, n):
        routing.AddVariableMinimizedByFinalizer(routing.NextVar(manager.NodeToIndex(node)))

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        print(json.dumps({"error": "Nenhuma solução encontrada"}))
        sys.exit(1)

    # Monta a ordem visitada
    index = routing.Start(0)
    plan = []
    while not routing.IsEnd(index):
        plan.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))
    print(json.dumps({"order": plan}))

if __name__ == '__main__':
    matrix = json.loads(sys.stdin.read())["matrix"]
    solve_tsp(matrix)
