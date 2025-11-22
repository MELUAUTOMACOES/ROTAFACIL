import sys
import json
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

data = json.load(sys.stdin)
matrix = data["matrix"]
terminar_no_ponto_inicial = bool(data.get("terminarNoPontoInicial", False))

# Debug -> STDERR
print("=== DEBUG Python ===", file=sys.stderr)
print("terminar_no_ponto_inicial:", terminar_no_ponto_inicial, file=sys.stderr)
print("Matriz tem", len(matrix), "pontos.", file=sys.stderr)
sys.stderr.flush()

# Custos inteiros pro OR-Tools
int_matrix = [[int(round(x)) for x in row] for row in matrix]

def create_data_model():
    return {
        "distance_matrix": int_matrix,
        "num_vehicles": 1,
        "depot": 0,
    }

def main():
    data_model = create_data_model()
    n = len(data_model["distance_matrix"])

    # Manager: circular (start=end) ou aberta (start=0, end=mais distante)
    if terminar_no_ponto_inicial or n <= 1:
        manager = pywrapcp.RoutingIndexManager(n, 1, 0)
        end_node = 0
    else:
        start = 0
        distancias = data_model["distance_matrix"][start]
        end_node = max(range(n), key=lambda i: distancias[i])
        manager = pywrapcp.RoutingIndexManager(n, 1, [start], [end_node])

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data_model["distance_matrix"][from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.FromSeconds(10)

    solution = routing.SolveWithParameters(search_parameters)

    result = {"order": [], "totalDistance": 0, "totalTime": 0, "legs": []}

    if solution:
        route = []
        legs = []
        total_distance = 0

        index = routing.Start(0)
        while True:
            node = manager.IndexToNode(index)
            route.append(node)

            if routing.IsEnd(index):
                break

            next_index = solution.Value(routing.NextVar(index))
            # NÃO cria leg quando o próximo é End (vamos tratar depois p/ rota aberta)
            if not routing.IsEnd(next_index):
                next_node = manager.IndexToNode(next_index)
                leg_distance = data_model["distance_matrix"][node][next_node]
                legs.append({
                    "from": node,
                    "to": next_node,
                    "distance": leg_distance,
                    "duration": leg_distance // 60
                })
                total_distance += leg_distance

            index = next_index

        # Redundância defensiva: para rota aberta, garante último == end_node
        if not terminar_no_ponto_inicial and route[-1] != end_node:
            route.append(end_node)

        # PATCH: em rota ABERTA, cria a ÚLTIMA perna até o nó final (visual da linha)
        if not terminar_no_ponto_inicial and len(route) >= 2:
            penultimate = route[-2]
            last = route[-1]
            # Evita duplicar se já existir
            if not legs or legs[-1]["to"] != last:
                leg_distance = data_model["distance_matrix"][penultimate][last]
                legs.append({
                    "from": penultimate,
                    "to": last,
                    "distance": leg_distance,
                    "duration": leg_distance // 60
                })
                total_distance += leg_distance

        result["order"] = route
        result["totalDistance"] = total_distance
        result["totalTime"] = total_distance // 60
        result["legs"] = legs
    else:
        result["error"] = "No solution found!"

    print(json.dumps(result))

if __name__ == "__main__":
    main()
